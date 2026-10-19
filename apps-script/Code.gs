/**
 * Gmail -> inbound-triage bridge (Google Apps Script).
 *
 * Runs on a time trigger. Finds new emails sent to the triage address, POSTs each one to
 * the backend /webhook with source "gmail", and labels the thread "triaged" so it is not
 * sent twice. Nothing is labeled unless the backend answered 2xx, so failures retry.
 *
 * Script Properties (Project Settings > Script properties). Never put these in the code:
 *   WEBHOOK_URL     full URL, e.g. https://<your-service>.onrender.com/webhook
 *   WEBHOOK_SECRET  same value as WEBHOOK_SECRET on the backend
 *   TRIAGE_ADDRESS  the plus-address that receives emails to triage
 *
 * Known limits:
 *   - Only the first message of a thread is sent. Later replies in a labeled thread are skipped.
 *   - Only threads, not single messages, can be labeled, so the label is per thread.
 */

const LABEL_NAME = 'triaged';
const MAX_THREADS_PER_RUN = 10; // keeps one run well inside Apps Script's 6 minute limit
const MAX_TEXT_LENGTH = 4000;   // email body is untrusted input; cap what goes to the LLM

/** Entry point for the time trigger. Sends new triage emails to the backend. */
function processTriageEmails() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('WEBHOOK_URL');
  const secret = props.getProperty('WEBHOOK_SECRET');
  const address = props.getProperty('TRIAGE_ADDRESS');
  if (!url || !secret || !address) {
    console.error('Missing script property: WEBHOOK_URL, WEBHOOK_SECRET or TRIAGE_ADDRESS');
    return;
  }

  const label = GmailApp.getUserLabelByName(LABEL_NAME) || GmailApp.createLabel(LABEL_NAME);
  const threads = GmailApp.search(
    'to:' + address + ' -label:' + LABEL_NAME, 0, MAX_THREADS_PER_RUN);

  for (const thread of threads) {
    const status = sendMessage_(url, secret, thread.getMessages()[0]);
    if (status >= 200 && status < 300) {
      thread.addLabel(label);
    } else if (status === 0 || status >= 500) {
      // Backend down or asleep: stop now, the next run retries everything unlabeled.
      console.error('Backend unavailable (status ' + status + '), stopping this run');
      return;
    } else {
      // 4xx: this one email was rejected. Log it and move on to the next.
      console.error('Backend rejected thread ' + thread.getId() + ' with status ' + status);
    }
  }
}

/**
 * POSTs one Gmail message to the backend.
 * @param {string} url Backend /webhook URL.
 * @param {string} secret Shared webhook secret (sent as X-Webhook-Secret).
 * @param {GoogleAppsScript.Gmail.GmailMessage} message The message to send.
 * @return {number} HTTP status code, or 0 if the request could not be made at all.
 */
function sendMessage_(url, secret, message) {
  const from = parseSender_(message.getFrom());
  const text = (message.getSubject() + '\n\n' + message.getPlainBody()).slice(0, MAX_TEXT_LENGTH);
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Webhook-Secret': secret },
      payload: JSON.stringify({ name: from.name, email: from.email, text: text, source: 'gmail' }),
      muteHttpExceptions: true, // return 4xx/5xx instead of throwing, so we can read the code
    });
    return response.getResponseCode();
  } catch (err) {
    console.error('Request failed: ' + err.message); // message only, never the headers
    return 0;
  }
}

/**
 * Splits a From header such as 'Jane Doe <jane@example.com>' into name and email.
 * Falls back to the bare address (used as the name too) when there is no display name.
 * @param {string} from Raw From header.
 * @return {{name: string, email: string}}
 */
function parseSender_(from) {
  const match = from.match(/^\s*"?(.*?)"?\s*<(.+)>\s*$/);
  if (!match) return { name: from, email: from };
  return { name: match[1] || match[2], email: match[2] };
}
