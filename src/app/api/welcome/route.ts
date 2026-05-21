import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mail';

function getWelcomeEmailHtml(fullName: string, email: string, origin: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to TaskFlow!</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f9fafb;
      color: #1f2937;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 580px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #e5e7eb;
    }
    .logo {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%);
      color: white;
      text-align: center;
      line-height: 40px;
      font-weight: bold;
      font-size: 20px;
      margin-bottom: 24px;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin-top: 0;
      margin-bottom: 12px;
      line-height: 1.25;
    }
    .description {
      font-size: 16px;
      color: #4b5563;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .feature-card {
      background-color: #f3f4f6;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .feature-title {
      font-weight: 600;
      font-size: 15px;
      color: #111827;
      margin-bottom: 4px;
    }
    .feature-desc {
      font-size: 14px;
      color: #4b5563;
      margin: 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      text-align: center;
      box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2);
    }
    .footer {
      margin-top: 32px;
      border-top: 1px solid #e5e7eb;
      padding-top: 24px;
      font-size: 13px;
      color: #9ca3af;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">T</div>
    <h1 class="title">Welcome to TaskFlow, ${fullName}!</h1>
    <p class="description">
      We are absolutely thrilled to welcome you to <strong>TaskFlow</strong>. 
      Whether you are organizing complex developer projects, managing high-octane sales workflows, or tracking daily tasks, TaskFlow gives you and your team the ultimate edge in organization and focus.
    </p>
    
    <div class="feature-card">
      <div class="feature-title">🎯 Organized Projects & Teams</div>
      <p class="feature-desc">Group tasks by Projects, Departments, or functional Teams to keep your workloads clean and segmented.</p>
    </div>
    
    <div class="feature-card">
      <div class="feature-title">📊 Real-Time Analytics</div>
      <p class="feature-desc">Monitor task progress, track team workload metrics, and spot bottlenecks instantly on your premium dashboard.</p>
    </div>

    <div class="feature-card">
      <div class="feature-title">💬 Collaboration Hub</div>
      <p class="feature-desc">Discuss priorities via direct task comments, attach key documents, and coordinate smoothly with team members.</p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${origin}/dashboard" class="btn" target="_blank">Go to Your Dashboard</a>
    </div>

    <div class="footer">
      This welcome email was sent to ${email} because you recently registered an account on TaskFlow. If you did not create an account, you can safely ignore this email.
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const { email, fullName } = await request.json();

    if (!email || !fullName) {
      return NextResponse.json({ error: 'Email and fullName are required' }, { status: 400 });
    }

    const origin = request.nextUrl.origin;

    // Send the email
    await sendEmail({
      to: email.toLowerCase(),
      subject: 'Welcome to TaskFlow! 🚀',
      html: getWelcomeEmailHtml(fullName, email.toLowerCase(), origin),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Welcome email error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
