import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createBrowserClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/mail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getInviteEmailHtml(orgName: string, inviterName: string, inviteUrl: string, email: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join ${orgName} on TaskFlow</title>
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
      font-size: 22px;
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
    <h1 class="title">Join ${orgName} on TaskFlow</h1>
    <p class="description">
      Hello,<br><br>
      <strong>${inviterName}</strong> has invited you to join their organization, <strong>${orgName}</strong>, on <strong>TaskFlow</strong>. 
      TaskFlow is a premium task and workflow management suite that keeps your team aligned and productive.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${inviteUrl}" class="btn" target="_blank">Accept Invitation</a>
    </div>
    <p class="description" style="font-size: 14px; color: #6b7280;">
      If the button above does not work, copy and paste this link into your web browser:<br>
      <span style="word-break: break-all; color: #6366f1;">${inviteUrl}</span>
    </p>
    <div class="footer">
      This invitation was sent by TaskFlow on behalf of ${inviterName} (${email}). If you did not expect this invitation, you can safely ignore this email.
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const { email, orgId, roleId } = await request.json();

    if (!email || !orgId) {
      return NextResponse.json({ error: 'Email and orgId are required' }, { status: 400 });
    }

    // Verify the caller is authenticated and has invite permissions
    const browserSupabase = await createBrowserClient();
    const { data: { user } } = await browserSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch org details using service role client (bypasses RLS)
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();
    const orgName = org?.name || 'their organization';

    // Fetch inviter's profile details using service role client
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    const inviterName = profile?.full_name || user.email || 'A team member';

    // Check if already a member
    const { data: existing } = await supabase
      .from('org_members')
      .select('id, status')
      .eq('org_id', orgId)
      .eq('invited_email', email.toLowerCase())
      .single();

    if (existing) {
      if (existing.status === 'active') {
        return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
      }
      // Re-send: return existing invite link and resend email
      const { data: existingMember } = await supabase
        .from('org_members')
        .select('invite_token')
        .eq('id', existing.id)
        .single();

      const inviteUrl = `${request.nextUrl.origin}/invite/accept?token=${existingMember?.invite_token}&email=${encodeURIComponent(email)}`;
      
      // Send the email
      await sendEmail({
        to: email.toLowerCase(),
        subject: `Reminder: Join ${orgName} on TaskFlow`,
        html: getInviteEmailHtml(orgName, inviterName, inviteUrl, email.toLowerCase()),
      });

      return NextResponse.json({ inviteUrl, message: 'Invite resent successfully!' });
    }

    // Create pending member with invite token
    const { data: member, error } = await supabase
      .from('org_members')
      .insert({
        org_id: orgId,
        invited_email: email.toLowerCase(),
        role_id: roleId || null,
        status: 'pending',
      })
      .select('invite_token')
      .single();

    if (error) {
      console.error('Invite error:', error);
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }

    const inviteUrl = `${request.nextUrl.origin}/invite/accept?token=${member.invite_token}&email=${encodeURIComponent(email)}`;

    // Send the email
    await sendEmail({
      to: email.toLowerCase(),
      subject: `Invitation to join ${orgName} on TaskFlow`,
      html: getInviteEmailHtml(orgName, inviterName, inviteUrl, email.toLowerCase()),
    });

    return NextResponse.json({ inviteUrl });
  } catch (err) {
    console.error('Invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

