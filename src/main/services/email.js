/**
 * Email service for BoulderRyn
 * Uses nodemailer with SMTP settings from the database
 */

const nodemailer = require('nodemailer');
const { getDb } = require('../database/db');

function getSetting(key) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
}

function createTransporter() {
  const smtpUser = getSetting('email_smtp_user');
  const smtpPass = getSetting('email_smtp_pass');
  if (!smtpUser || !smtpPass) {
    throw new Error('Email not configured. Set SMTP credentials in Settings > Integrations.');
  }
  return nodemailer.createTransport({
    host: getSetting('email_smtp_host') || 'smtp.gmail.com',
    port: parseInt(getSetting('email_smtp_port') || '587'),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass }
  });
}

function getFromAddress() {
  return getSetting('email_from') || getSetting('email_smtp_user');
}

/**
 * Send QR code email to a member
 */
async function sendQrEmail(member, qrBuffer) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to: member.email,
    subject: 'Your BoulderRyn Membership QR Code',
    text: `Hi ${member.first_name},\n\nHere's your BoulderRyn QR code. Save this image to your phone and show it at the desk when you check in.\n\nYour code: ${member.qr_code}\n\nSee you on the wall!\nBoulderRyn`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #1E3A5F;">BoulderRyn</h2>
        <p>Hi ${member.first_name},</p>
        <p>Here's your BoulderRyn QR code. Save this image to your phone and show it at the desk when you check in.</p>
        <p style="text-align: center; margin: 24px 0;">
          <img src="cid:qrcode" alt="QR Code" style="width: 250px; height: 250px;" />
        </p>
        <p style="text-align: center; color: #666; font-size: 14px;">Code: ${member.qr_code}</p>
        <p>See you on the wall!<br/>BoulderRyn</p>
      </div>
    `,
    attachments: [
      { filename: 'boulderryn-qr.png', content: qrBuffer, cid: 'qrcode' },
      { filename: 'boulderryn-qr.png', content: qrBuffer }
    ]
  });
}

/**
 * Send receipt email to a member
 */
async function sendReceiptEmail(member, transaction, items) {
  const transporter = createTransporter();
  const date = new Date(transaction.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const itemsHtml = items.map(item =>
    `<tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${item.description}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">£${parseFloat(item.total_price).toFixed(2)}</td>
    </tr>`
  ).join('');

  const itemsText = items.map(item =>
    `  ${item.description} x${item.quantity} — £${parseFloat(item.total_price).toFixed(2)}`
  ).join('\n');

  await transporter.sendMail({
    from: getFromAddress(),
    to: member.email,
    subject: `BoulderRyn Receipt - ${date}`,
    text: `Hi ${member.first_name},\n\nHere's your receipt from BoulderRyn.\n\nDate: ${date}\nPayment: ${transaction.payment_method === 'dojo_card' ? 'Card' : transaction.payment_method}\n\nItems:\n${itemsText}\n\nTotal: £${parseFloat(transaction.total_amount).toFixed(2)}\n\nThank you for visiting BoulderRyn!`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #1E3A5F;">BoulderRyn</h2>
        <p>Hi ${member.first_name},</p>
        <p>Here's your receipt from BoulderRyn.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 4px; color: #666; font-size: 14px;">Date: ${date}</p>
          <p style="margin: 0; color: #666; font-size: 14px;">Payment: ${transaction.payment_method === 'dojo_card' ? 'Card' : transaction.payment_method}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #1E3A5F;">
              <th style="text-align: left; padding: 8px 0; font-size: 14px;">Item</th>
              <th style="text-align: center; padding: 8px 0; font-size: 14px;">Qty</th>
              <th style="text-align: right; padding: 8px 0; font-size: 14px;">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p style="text-align: right; font-size: 18px; font-weight: bold; color: #1E3A5F;">Total: £${parseFloat(transaction.total_amount).toFixed(2)}</p>
        <p style="color: #666; font-size: 14px;">Thank you for visiting BoulderRyn!</p>
      </div>
    `
  });
}

/**
 * Send waiver confirmation email
 */
async function sendWaiverConfirmEmail(member) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to: member.email,
    subject: 'BoulderRyn - Waiver Confirmed',
    text: `Hi ${member.first_name},\n\nYour waiver has been recorded. See you at the gym!\n\nBoulderRyn`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #1E3A5F;">BoulderRyn</h2>
        <p>Hi ${member.first_name},</p>
        <p>Your waiver has been recorded. You're all set to climb!</p>
        <p style="margin: 24px 0; text-align: center;">
          <span style="display: inline-block; background: #10B981; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 16px;">✓ Waiver Confirmed</span>
        </p>
        <p>See you at the gym!<br/>BoulderRyn</p>
      </div>
    `
  });
}

/**
 * Send welcome email to new member
 */
async function sendWelcomeEmail(member) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to: member.email,
    subject: 'Welcome to BoulderRyn!',
    text: `Hi ${member.first_name},\n\nWelcome to BoulderRyn! Your registration is complete.\n\nYou'll receive a separate email with your membership QR code — save it to your phone and show it at the desk when you check in.\n\nSee you on the wall!\nBoulderRyn`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #1E3A5F;">Welcome to BoulderRyn!</h2>
        <p>Hi ${member.first_name},</p>
        <p>Your registration is complete. We're stoked to have you!</p>
        <p>You'll receive a separate email with your membership QR code — save it to your phone and show it at the desk when you check in.</p>
        <div style="background: #EFF6FF; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; font-weight: bold; color: #1E3A5F;">What's next?</p>
          <ul style="margin: 8px 0 0; padding-left: 20px; color: #374151;">
            <li>Complete your waiver (if you haven't already)</li>
            <li>Visit the desk to get your first entry pass</li>
            <li>Start climbing!</li>
          </ul>
        </div>
        <p>See you on the wall!<br/>BoulderRyn</p>
      </div>
    `
  });
}

module.exports = {
  sendQrEmail,
  sendReceiptEmail,
  sendWaiverConfirmEmail,
  sendWelcomeEmail,
  createTransporter,
  getFromAddress,
};
