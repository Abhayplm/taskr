import nodemailer from 'nodemailer';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let testAccountPromise: Promise<any> | null = null;

async function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && port && user && pass) {
    return nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: port === '465', // true for 465, false for 587 or other ports
      auth: { user, pass },
    });
  }

  // If no SMTP configured, use Ethereal for testing
  if (!testAccountPromise) {
    testAccountPromise = nodemailer.createTestAccount();
  }
  const testAccount = await testAccountPromise;
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

/**
 * Sends an email using either configured SMTP or Ethereal fallback.
 * Also prints the email details beautifully to the console for easy debugging.
 */
export async function sendEmail({ to, subject, html, text }: SendMailOptions) {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM || '"TaskFlow" <onboarding@taskflow.com>';

  console.log('\n┌────────────────────────────────────────────────────────┐');
  console.log(`│ 📧 SENDING EMAIL                                       │`);
  console.log(`│ To:      ${to.padEnd(46)} │`);
  console.log(`│ Subject: ${subject.padEnd(46)} │`);
  console.log('├────────────────────────────────────────────────────────┤');

  // Extract and print any URLs in the text/html to make it easy to copy for local development
  const urlRegex = /href="([^"]+)"/g;
  const matches = [...html.matchAll(urlRegex)];
  const links = matches.map(m => m[1]);
  if (links.length > 0) {
    console.log('│ 🔗 Quick Action Links:                                  │');
    links.forEach(link => {
      console.log(`│   ${link.substring(0, 52).padEnd(52)} │`);
      if (link.length > 52) {
        console.log(`│   ${link.substring(52).padEnd(52)} │`);
      }
    });
    console.log('├────────────────────────────────────────────────────────┤');
  }

  if (!host) {
    console.log('│ ⚠️  SMTP is not configured in .env.local               │');
    console.log('│ Running in fallback mode. Dynamically routing mail...  │');
  }

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: text || subject,
      html,
    });

    if (!host) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('│                                                        │');
      console.log('│ 🚀 Ethereal Mock Mail Sent!                            │');
      console.log(`│ Preview URL:                                           │`);
      console.log(`│   ${(previewUrl || '').substring(0, 52).padEnd(52)} │`);
      if (previewUrl && previewUrl.length > 52) {
        console.log(`│   ${previewUrl.substring(52).padEnd(52)} │`);
      }
      console.log('│                                                        │');
    } else {
      console.log(`│ ✅ Mail sent successfully! (ID: ${info.messageId.substring(0, 20)}...) │`);
    }
  } catch (err: any) {
    console.log('│ ❌ ERROR SENDING EMAIL:                                │');
    console.log(`│   ${err.message.substring(0, 52).padEnd(52)} │`);
  }
  console.log('└────────────────────────────────────────────────────────┘\n');
}
