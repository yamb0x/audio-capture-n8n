// This runs on Google Meet pages
// Could be extended to detect meeting start/end automatically

console.log('Meet Audio Capture: Content script loaded');

// Optional: Detect when meeting starts
const observer = new MutationObserver((mutations) => {
  // Look for meeting UI elements
  const meetingStarted = document.querySelector('[data-call-active="true"]');
  if (meetingStarted) {
    console.log('Meeting detected as started');
    // Could auto-start recording here
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});