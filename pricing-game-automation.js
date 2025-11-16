import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

// Default URLs (local)
let INSTRUCTOR_URL = 'http://localhost:5173/instructor';
let STUDENT_URL = 'http://localhost:5173';

// Parse command line arguments
let NUM_STUDENTS = 6; // Default number of students (must be even for pairing)
let AUTO_SUBMIT = false;
let USE_ONLINE = false;
let NUM_ROUNDS = null; // Default: null means use game's default settings

// Check for flags
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '-a' || arg === '--auto') {
    AUTO_SUBMIT = true;
    // Check if next argument is a number
    if (i + 1 < process.argv.length && !isNaN(process.argv[i + 1])) {
      NUM_STUDENTS = parseInt(process.argv[i + 1], 10);
      i++; // Skip the next argument since we used it
    }
  } else if (arg === '-o' || arg === '--online') {
    USE_ONLINE = true;
    INSTRUCTOR_URL = 'https://games-theta-swart.vercel.app/instructor';
    STUDENT_URL = 'https://games-theta-swart.vercel.app';
  } else if (arg === '-r' || arg === '--rounds') {
    // Check if next argument is a number
    if (i + 1 < process.argv.length && !isNaN(process.argv[i + 1])) {
      NUM_ROUNDS = parseInt(process.argv[i + 1], 10);
      i++; // Skip the next argument since we used it
    }
  }
}

// Ensure even number of students for pairing
if (NUM_STUDENTS % 2 !== 0) {
  NUM_STUDENTS += 1;
  console.log(`⚠️  Adjusted to ${NUM_STUDENTS} students (must be even for pairing)`);
}

console.log(`Configuration: ${NUM_STUDENTS} students, Auto-submit: ${AUTO_SUBMIT}, Online: ${USE_ONLINE}${NUM_ROUNDS ? `, Rounds: ${NUM_ROUNDS}` : ''}`);

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

async function setupInstructor(browser) {
  let instructorPage;
  try {
    console.log('🎓 Setting up instructor...');
    
    instructorPage = await browser.newPage();
    
    // Set up error handlers for the page
    instructorPage.on('pageerror', error => {
      console.log('⚠️  Page error:', error.message);
    });
    
    instructorPage.on('error', error => {
      console.log('⚠️  Page crashed:', error.message);
    });
    
    console.log(`🔗 Navigating to ${INSTRUCTOR_URL}...`);
    const timeout = USE_ONLINE ? 30000 : 10000;
    await instructorPage.goto(INSTRUCTOR_URL, { 
      waitUntil: 'domcontentloaded',
      timeout 
    }).catch(err => {
      throw new Error(`Failed to navigate to instructor page: ${err.message}`);
    });
    
    // Wait for React to render
    await delay(USE_ONLINE ? 3000 : 1500);
    
    console.log('📝 Looking for "New Game" button...');
    
    // Try to wait for buttons to appear
    try {
      await instructorPage.waitForSelector('button', { timeout: 5000 });
    } catch (e) {
      console.log('⚠️  Timeout waiting for buttons, trying anyway...');
    }
    
    // Get all buttons and find the New Game button
    const buttons = await instructorPage.$$('button').catch(() => []);
    
    if (buttons.length === 0) {
      await instructorPage.screenshot({ path: 'instructor-no-buttons.png' });
      throw new Error('No buttons found on instructor page');
    }
    
    console.log(`Found ${buttons.length} button(s) on page`);
    
    let clicked = false;
    for (const button of buttons) {
      const text = await button.evaluate(el => el.textContent.trim()).catch(() => '');
      console.log(`  Button text: "${text}"`);
      if (text.toLowerCase().includes('new') && text.toLowerCase().includes('game')) {
        console.log('🖱️  Clicking New Game button...');
        await button.click();
        clicked = true;
        break;
      }
    }
    
    if (!clicked) {
      console.log('❌ Could not find New Game button');
      await instructorPage.screenshot({ path: 'instructor-screenshot.png' });
      throw new Error('New Game button not found');
    }
    
    console.log('✅ Clicked New Game button');
    
    // Wait for form to expand
    await delay(1000);
    
    // If NUM_ROUNDS is specified, set the rounds input
    if (NUM_ROUNDS !== null) {
      console.log(`🔢 Setting number of rounds to ${NUM_ROUNDS}...`);
      try {
        const roundsInput = await instructorPage.$('input[type="number"]').catch(() => null);
        if (roundsInput) {
          // Clear existing value and set new value
          await roundsInput.click({ clickCount: 3 }); // Select all
          await roundsInput.type(String(NUM_ROUNDS));
          console.log(`✅ Set rounds to ${NUM_ROUNDS}`);
        } else {
          console.log('⚠️  Could not find rounds input field');
        }
      } catch (e) {
        console.log('⚠️  Error setting rounds:', e.message);
      }
      await delay(500);
    }
    
    // Look for "Create Session" submit button
    console.log('📝 Looking for "Create Session" button...');
    const submitButtons = await instructorPage.$$('button').catch(() => []);
    
    clicked = false;
    for (const button of submitButtons) {
      const text = await button.evaluate(el => el.textContent.trim()).catch(() => '');
      if (text.toLowerCase().includes('create') && text.toLowerCase().includes('session')) {
        console.log('🖱️  Clicking Create Session button...');
        await button.click();
        clicked = true;
        break;
      }
    }
    
    if (!clicked) {
      // Try clicking the first primary button as fallback
      const primaryButton = await instructorPage.$('button.primary').catch(() => null);
      if (primaryButton) {
        console.log('🖱️  Clicking primary button (fallback)...');
        await primaryButton.click();
        clicked = true;
      }
    }
    
    if (!clicked) {
      console.log('❌ Could not find Create Session button');
      await instructorPage.screenshot({ path: 'instructor-screenshot.png' });
      throw new Error('Create Session button not found');
    }
    
    console.log('✅ Clicked Create Session button');
    
    // Wait for session code to appear (API call + React render + redirect)
    await delay(2000);
    
    // Try to extract session code
    let sessionCode = null;
    
    console.log('🔍 Searching for session code...');
    
    // The session code should appear in the management page after creation
    sessionCode = await instructorPage.evaluate(() => {
      // Look for the session code display
      const allStrong = Array.from(document.querySelectorAll('strong'));
      for (const strong of allStrong) {
        const text = strong.textContent.trim();
        // Session codes are exactly 4 alphanumeric characters
        if (/^[A-Z0-9]{4}$/.test(text)) {
          return text;
        }
      }
      
      // Also check for code patterns in regular text
      const bodyText = document.body.textContent;
      const codeMatch = bodyText.match(/\b([A-Z0-9]{4})\b/);
      if (codeMatch) {
        return codeMatch[1];
      }
      
      return null;
    }).catch(() => null);
    
    if (!sessionCode) {
      console.log('❌ Could not extract session code automatically');
      
      // Take a screenshot for debugging
      await instructorPage.screenshot({ path: 'instructor-screenshot.png' });
      console.log('📸 Screenshot saved to instructor-screenshot.png');
      
      // Also save HTML for debugging
      const html = await instructorPage.content().catch(() => '<error getting html>');
      writeFileSync('instructor-debug.html', html);
      console.log('📄 HTML saved to instructor-debug.html');
      
      throw new Error('Session code not found');
    }
    
    console.log(`✅ Session Code: ${sessionCode}`);
    
    return { instructorPage, sessionCode };
  } catch (error) {
    console.error('❌ Error in setupInstructor:', error.message);
    if (instructorPage) {
      await instructorPage.screenshot({ path: 'instructor-error.png' }).catch(() => {});
    }
    throw error;
  }
}

async function setupStudent(browser, studentNum, sessionCode) {
  let studentPage;
  try {
    console.log(`👤 Setting up Student ${studentNum}...`);
    studentPage = await browser.newPage();
    
    // Set up error handlers
    studentPage.on('pageerror', error => {
      console.log(`⚠️  Student ${studentNum} page error:`, error.message);
    });
    
    const timeout = 30000;
    await studentPage.goto(STUDENT_URL, { 
      waitUntil: 'domcontentloaded',
      timeout
    }).catch(err => {
      throw new Error(`Student ${studentNum}: Failed to navigate: ${err.message}`);
    });
    
    await delay(500);
    
    // Wait for the form to be ready
    let formReady = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!formReady && attempts < maxAttempts) {
      attempts++;
      try {
        await studentPage.waitForSelector('input[type="text"]', { timeout: 10000 });
        formReady = true;
      } catch (e) {
        console.log(`⚠️  Student ${studentNum}: Form not ready (attempt ${attempts}/${maxAttempts})...`);
        if (attempts < maxAttempts) {
          await delay(2000);
          console.log(`🔄 Student ${studentNum}: Refreshing page...`);
          await studentPage.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await delay(1000);
        }
      }
    }
    
    if (!formReady) {
      const screenshot = `student-${studentNum}-no-form.png`;
      await studentPage.screenshot({ path: screenshot });
      console.log(`📸 Screenshot saved to ${screenshot}`);
      console.log(`⚠️  Student ${studentNum}: Skipping due to form load failure`);
      return null;
    }
    
    // Find and fill the first name input
    const firstNameInput = await studentPage.$('#first-name').catch(() => null);
    if (firstNameInput) {
      await firstNameInput.type(`Student${studentNum}`, { delay: 0 });
      console.log(`✅ Student ${studentNum}: Entered first name`);
    }
    
    await delay(50);
    
    // Find and fill the last name input
    const lastNameInput = await studentPage.$('#last-name').catch(() => null);
    if (lastNameInput) {
      await lastNameInput.type(`Test`, { delay: 0 });
      console.log(`✅ Student ${studentNum}: Entered last name`);
    }
    
    await delay(50);
    
    // Find the session code input
    const codeInput = await studentPage.$('#session-code').catch(() => null);
    
    if (!codeInput) {
      const screenshot = `student-${studentNum}-screenshot.png`;
      await studentPage.screenshot({ path: screenshot });
      console.log(`📸 Screenshot saved to ${screenshot}`);
      throw new Error(`Student ${studentNum}: Session code input field not found`);
    }
    
    // Enter session code
    await codeInput.type(sessionCode, { delay: 0 });
    console.log(`✅ Student ${studentNum}: Entered session code`);
    
    await delay(100);
    
    // Look for "Join" button
    let joined = false;
    let retries = 3;
    
    while (!joined && retries > 0) {
      const buttons = await studentPage.$$('button').catch(() => []);
      
      for (const button of buttons) {
        const text = await button.evaluate(el => el.textContent).catch(() => '');
        if (text.toLowerCase().includes('join')) {
          // Check if button is visible and clickable
          const isVisible = await button.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && !el.disabled;
          }).catch(() => false);
          
          if (isVisible) {
            await button.click();
            joined = true;
            console.log(`✅ Student ${studentNum}: Clicked Join Session`);
            break;
          }
        }
      }
      
      if (!joined) {
        retries--;
        console.log(`⚠️  Student ${studentNum}: Join button not clickable, retrying... (${retries} left)`);
        await delay(1000);
      }
    }
    
    if (!joined) {
      await studentPage.screenshot({ path: `student-${studentNum}-error.png` });
      throw new Error(`Student ${studentNum}: Join button not found or not clickable`);
    }
    
    console.log(`✅ Student ${studentNum}: Successfully joined session`);
    await delay(300);
    
    return studentPage;
  } catch (error) {
    console.error(`❌ Error setting up Student ${studentNum}:`, error.message);
    if (studentPage) {
      await studentPage.screenshot({ path: `student-${studentNum}-error.png` }).catch(() => {});
    }
    throw error;
  }
}

async function autoSubmitForStudent(studentPage, studentNum, roundsToPlay, priceBounds) {
  console.log(`🤖 Auto-submit enabled for Student ${studentNum}`);
  
  for (let round = 1; round <= roundsToPlay; round++) {
    try {
      // Wait for round to start - look for enabled price input
      console.log(`⏳ Student ${studentNum} Round ${round}: Waiting for round to start...`);
      
      let inputEnabled = false;
      let attempts = 0;
      const maxAttempts = 45; // 45 seconds max wait
      
      while (!inputEnabled && attempts < maxAttempts) {
        inputEnabled = await studentPage.evaluate(() => {
          const input = document.querySelector('input[type="number"]');
          return input && !input.disabled;
        }).catch(() => false);
        
        if (!inputEnabled) {
          await delay(1000);
          attempts++;
        }
      }
      
      if (!inputEnabled) {
        console.log(`⚠️  Student ${studentNum} Round ${round}: Input never became ready`);
        continue;
      }
      
      console.log(`✅ Student ${studentNum} Round ${round}: Round started`);
      
      // Generate random price within bounds
      const minPrice = priceBounds?.min || 0;
      const maxPrice = priceBounds?.max || 20;
      const randomPrice = (Math.random() * (maxPrice - minPrice) + minPrice).toFixed(2);
      
      console.log(`💰 Student ${studentNum} Round ${round}: Attempting to submit price $${randomPrice}`);
      
      // Fill in the price input (React-compatible way)
      const inputResult = await studentPage.evaluate((price) => {
        const input = document.querySelector('input[type="number"]');
        if (!input) return { success: false, reason: 'Input not found' };
        if (input.disabled) return { success: false, reason: 'Input disabled' };
        
        // Clear the input first
        input.value = '';
        input.focus();
        
        // Use React's way to trigger changes
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        ).set;
        nativeInputValueSetter.call(input, price);
        
        // Trigger React's onChange by dispatching multiple events
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        
        return { success: true, value: input.value };
      }, randomPrice);
      
      await delay(500);
      
      // Click submit button
      const submitted = await studentPage.evaluate(() => {
        const input = document.querySelector('input[type="number"]');
        const inputValue = input ? input.value : 'no input';
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const button of buttons) {
          const text = button.textContent.toLowerCase();
          if ((text.includes('submit') || text.includes('set')) && !button.disabled) {
            button.click();
            return { success: true, inputValue };
          }
        }
        return { success: false, inputValue };
      }).catch(() => ({ success: false, inputValue: 'error' }));
      
      if (submitted.success) {
        console.log(`✅ Student ${studentNum} Round ${round}: Submitted successfully with price $${submitted.inputValue}`);
      } else {
        console.log(`⚠️  Student ${studentNum} Round ${round}: Could not submit (input value was ${submitted.inputValue})`);
      }
      
      // Wait for input to become disabled (round ended)
      console.log(`⏳ Student ${studentNum} Round ${round}: Waiting for round to end...`);
      let roundEnded = false;
      attempts = 0;
      
      while (!roundEnded && attempts < 30) {
        roundEnded = await studentPage.evaluate(() => {
          const input = document.querySelector('input[type="number"]');
          return !input || input.disabled;
        }).catch(() => true);
        
        if (!roundEnded) {
          await delay(1000);
          attempts++;
        }
      }
      
      console.log(`✅ Student ${studentNum} Round ${round}: Round complete`);
      
      // Extra wait for results to display
      await delay(2000);
      
    } catch (error) {
      console.error(`❌ Student ${studentNum} Round ${round} error:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 Starting Pricing Game Test Automation...\n');
  
  let browser;
  
  try {
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-popup-blocking',
        '--no-first-run',
        '--no-default-browser-check',
        '--max-connections-per-host=100',
        '--socket-reuse-policy=0'
      ],
      defaultViewport: null,
      ignoreHTTPSErrors: true,
      protocolTimeout: 30000
    });
    
    console.log('✅ Browser launched successfully\n');
    
    // Handle browser disconnection
    browser.on('disconnected', () => {
      console.log('⚠️  Browser disconnected');
    });
    
    // Setup instructor and get session code
    const { instructorPage, sessionCode } = await setupInstructor(browser);
    
    console.log('\n' + '='.repeat(50));
    console.log(`📋 SESSION CODE: ${sessionCode}`);
    console.log('='.repeat(50) + '\n');
    
    // Setup students
    const studentPages = [];
    const MAX_OPEN_TABS = 31;
    const delayBetweenStudents = USE_ONLINE ? 500 : 100;
    console.log(`\n👥 Creating ${NUM_STUDENTS} student tabs...`);
    if (USE_ONLINE) {
      console.log('⏱️  Using 500ms delay between students for online mode\n');
    }
    
    for (let i = 1; i <= NUM_STUDENTS; i++) {
      const studentPage = await setupStudent(browser, i, sessionCode);
      if (studentPage) {
        studentPages.push(studentPage);
        
        // If we have more students than the connection limit, close older tabs
        if (NUM_STUDENTS > MAX_OPEN_TABS && studentPages.length > MAX_OPEN_TABS) {
          const tabToClose = studentPages.shift();
          const closedStudentNum = i - MAX_OPEN_TABS;
          try {
            await tabToClose.close();
            console.log(`🗑️  Closed Student ${closedStudentNum} tab to free connection`);
          } catch (err) {
            console.log(`⚠️  Failed to close Student ${closedStudentNum} tab:`, err.message);
          }
        }
      } else {
        console.log(`⚠️  Student ${i} failed to join (skipped)`);
      }
      await delay(delayBetweenStudents);
    }
    
    console.log(`\n✅ ${NUM_STUDENTS} students joined successfully!`);
    if (NUM_STUDENTS > MAX_OPEN_TABS) {
      console.log(`   (Keeping last ${studentPages.length} tabs open, others closed to avoid connection limits)`);
    }
    
    // Wait for the instructor dashboard to update with all players
    await delay(1500);
    
    // Click "Start Game" button on instructor page
    console.log('\n🎮 Starting the game...');
    try {
      // Bring instructor page to front
      await instructorPage.bringToFront();
      
      // Look for the "Start Game" button
      const startButtons = await instructorPage.$$('button').catch(() => []);
      let started = false;
      
      for (const button of startButtons) {
        const text = await button.evaluate(el => el.textContent.trim()).catch(() => '');
        if (text.toLowerCase().includes('start') && text.toLowerCase().includes('game')) {
          console.log('🖱️  Clicking Start Game button...');
          await button.click();
          started = true;
          break;
        }
      }
      
      if (!started) {
        console.log('⚠️  Could not find Start Game button');
        console.log('    Make sure all students have joined and pairing is complete');
      } else {
        console.log('✅ Game started!');
        
        // If auto-submit is enabled, start auto-submitting for all students
        if (AUTO_SUBMIT) {
          console.log('\n🤖 Auto-submit mode enabled! Students will automatically submit prices.');
          
          // Get game configuration from instructor page
          let ROUNDS = 2;
          let priceBounds = { min: 0, max: 20 };
          
          try {
            const config = await instructorPage.evaluate(() => {
              const bodyText = document.body.textContent;
              
              // Try to extract rounds
              const roundMatch = bodyText.match(/Round \d+ of (\d+)/i) || 
                                bodyText.match(/Total Rounds:\s*(\d+)/i) ||
                                bodyText.match(/Rounds:\s*(\d+)/i);
              const rounds = roundMatch ? parseInt(roundMatch[1]) : 2;
              
              // Try to extract price bounds
              const boundsMatch = bodyText.match(/\$(\d+)\s*-\s*\$(\d+)/);
              const bounds = boundsMatch ? {
                min: parseInt(boundsMatch[1]),
                max: parseInt(boundsMatch[2])
              } : { min: 0, max: 20 };
              
              return { rounds, bounds };
            }).catch(() => ({ rounds: 2, bounds: { min: 0, max: 20 } }));
            
            ROUNDS = config.rounds;
            priceBounds = config.bounds;
            console.log(`📊 Detected game config: ${ROUNDS} rounds, prices $${priceBounds.min}-$${priceBounds.max}`);
          } catch (e) {
            console.log(`⚠️  Could not detect game config, using defaults: ${ROUNDS} rounds`);
          }
          
          // Start auto-submit for each student (in parallel)
          const autoSubmitPromises = studentPages.map((page, index) => {
            return autoSubmitForStudent(page, index + 1, ROUNDS, priceBounds);
          });
          
          // Don't await these - let them run in background
          Promise.all(autoSubmitPromises).catch(err => {
            console.error('Error in auto-submit:', err);
          });
        }
      }
    } catch (error) {
      console.log('⚠️  Error trying to start game:', error.message);
    }
    
    console.log(`\n🎮 Game session ready with ${NUM_STUDENTS} students`);
    if (AUTO_SUBMIT) {
      console.log('🤖 Auto-submit is ENABLED - students will submit automatically');
    } else {
      console.log('💡 Tip: Use -a or --auto flag to enable auto-submit for students');
      console.log('💡 Example: npm run test-game -- -a 6 (opens 6 students with auto-submit)');
      console.log('💡 Flags: -r [number] to set rounds, -o for online mode');
    }
    console.log('🖥️  Browser windows will remain open for testing');
    console.log('⏹️  Press Ctrl+C to close all windows and exit\n');
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down...');
      await browser.close();
      process.exit(0);
    });
    
    // Keep the script running
    await new Promise(() => {});
    
  } catch (error) {
    console.error('\n❌ Error during automation:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError.message);
      }
    }
    process.exit(1);
  }
}

// Suppress certain Puppeteer warnings
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning') {
    return;
  }
  console.warn(warning);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

