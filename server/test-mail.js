// Quick SMTP test — run with: node test-mail.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: Number(process.env.MAIL_PORT) === 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  debug: true,
  logger: true,
});

async function test() {
  console.log('--- SMTP Config ---');
  console.log('Host :', process.env.MAIL_HOST);
  console.log('Port :', process.env.MAIL_PORT);
  console.log('User :', process.env.MAIL_USER);
  console.log('From :', process.env.MAIL_FROM);
  console.log('To   :', process.env.SOCIAL_APPROVAL_EMAIL);
  console.log('-------------------\n');

  try {
    await transporter.verify();
    console.log('✅ SMTP connection OK\n');
  } catch (err) {
    console.error('❌ SMTP connection FAILED:', err.message);
    console.error('\nFix: Generate a new App Password for', process.env.MAIL_USER);
    console.error('Go to: https://myaccount.google.com/apppasswords');
    process.exit(1);
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.SOCIAL_APPROVAL_EMAIL,
      subject: '✅ SMTP Test — Automation Approval Email',
      html: '<h2>SMTP is working!</h2><p>This is a test from your automation system.</p>',
    });
    console.log('✅ Test email sent! Message ID:', info.messageId);
    console.log('Check inbox at:', process.env.SOCIAL_APPROVAL_EMAIL);
  } catch (err) {
    console.error('❌ Send failed:', err.message);
  }
}

test();
