// Gmail -> inbound-triage bridge (Google Apps Script). Runs on a time trigger.
// Sends each new email to the backend /webhook with source "gmail", then labels the
// thread "triaged" so it is not sent twice. See RUNBOOK.md for setup.
//
// Before using: replace YOUR_TRIAGE_ADDRESS with the plus-address that receives emails
// to triage, and add a Script Property named WEBHOOK_SECRET (same value as on Render).
// Never put the secret in this file.

const WEBHOOK_URL = 'https://inbound-triage.onrender.com/webhook';
const LABEL_NAME = 'triaged';

function sendNewEmailsToTriage() {
  const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  const label = GmailApp.getUserLabelByName(LABEL_NAME) || GmailApp.createLabel(LABEL_NAME);
  const threads = GmailApp.search('to:YOUR_TRIAGE_ADDRESS -label:' + LABEL_NAME + ' newer_than:1d', 0, 20);

  for (const thread of threads) {
    const msg = thread.getMessages().pop();
    const from = msg.getFrom(); // e.g. "Juan Cruz <juan@example.com>"
    const match = from.match(/^(.*?)\s*<(.+)>$/);
    const payload = {
      name: match ? match[1].replace(/"/g, '') || match[2] : from,
      email: match ? match[2] : from,
      text: msg.getSubject() + '\n\n' + msg.getPlainBody().slice(0, 4000),
      source: 'gmail',
      external_id: msg.getId(), // backend skips an id it has already saved
    };

    const res = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Webhook-Secret': secret },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    // Only mark it done if the backend accepted it, so failures retry next run
    if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
      thread.addLabel(label);
    } else {
      console.log('Failed: ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
    }
  }
}
