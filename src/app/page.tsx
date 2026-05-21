'use client';

import Link from 'next/link';
import {
  CheckSquare, Users, Key, BarChart3, Shield,
  ArrowRight, Calendar, Sparkles, Target, GitBranch, Zap,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Navigation */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '72px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 var(--space-8)',
        background: 'rgba(10, 10, 15, 0.8)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-subtle)', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
            background: 'var(--gradient-brand)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--text-md)', fontWeight: 800, color: 'white',
          }}>T</div>
          <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
            Task<span className="text-gradient">Flow</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Link href="/login" className="btn btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn btn-primary">
            Get Started Free <ArrowRight size={16} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        paddingTop: '180px', paddingBottom: '120px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--gradient-mesh)', pointerEvents: 'none' }} />
        <div style={{
          position: 'absolute', width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 60%)',
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: '800px', margin: '0 auto', padding: '0 var(--space-6)' }}>
          <div className="animate-fade-in-up" style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
            padding: 'var(--space-1) var(--space-4)', borderRadius: 'var(--radius-full)',
            background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)',
            fontSize: 'var(--text-sm)', color: 'var(--brand-300)', marginBottom: 'var(--space-6)',
          }}>
            <Sparkles size={14} /> Built for high-performance teams
          </div>

          <h1 className="animate-fade-in-up delay-1" style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800,
            lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 'var(--space-6)',
          }}>
            Manage Tasks, Ship Faster,
            <br />
            <span className="text-gradient">Build Better Together</span>
          </h1>

          <p className="animate-fade-in-up delay-2" style={{
            fontSize: 'var(--text-lg)', color: 'var(--text-secondary)',
            maxWidth: '600px', margin: '0 auto var(--space-8)',
            lineHeight: 'var(--leading-relaxed)',
          }}>
            TaskFlow is the all-in-one task management platform for modern teams.
            Kanban boards, custom roles, real analytics, a REST API — all beautifully designed.
          </p>

          <div className="animate-fade-in-up delay-3" style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)' }}>
            <Link href="/signup" className="btn btn-primary btn-lg"
              style={{ fontSize: 'var(--text-base)', padding: 'var(--space-3) var(--space-8)' }}>
              Start for Free <ArrowRight size={18} />
            </Link>
            <Link href="#features" className="btn btn-secondary btn-lg"
              style={{ fontSize: 'var(--text-base)', padding: 'var(--space-3) var(--space-8)' }}>
              See Features
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: 'var(--space-24) var(--space-8)', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-16)' }}>
          <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            Everything you need to{' '}
            <span className="text-gradient">ship work faster</span>
          </h2>
          <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            TaskFlow gives your team the tools to plan, assign, track, and complete work — without the noise.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-6)' }}>
          {[
            {
              icon: CheckSquare, title: 'Kanban Task Board',
              description: 'Drag-and-drop tasks across Todo, In Progress, In Review, Done, and Blocked. Filter by type, priority, assignee, or label.',
              color: '#6366f1',
            },
            {
              icon: Users, title: 'Custom Team Roles',
              description: 'Create fully custom roles (Designer, QA Lead, etc.) with granular permission controls. No more one-size-fits-all access.',
              color: '#06b6d4',
            },
            {
              icon: Calendar, title: 'Due-Date Calendar',
              description: 'See all tasks by due date in a beautiful calendar view. Filter to just your tasks or view the entire team.',
              color: '#22c55e',
            },
            {
              icon: BarChart3, title: 'Real Analytics',
              description: 'Completion rates, task trends, team workload, project progress — all real data with date range filters.',
              color: '#f59e0b',
            },
            {
              icon: Key, title: 'Developer REST API',
              description: 'Generate API keys with read/write scopes. Full REST API for tasks, projects, and labels. Build integrations in any language.',
              color: '#ec4899',
            },
            {
              icon: Shield, title: 'Role-Based Access',
              description: 'Fine-grained permissions per role. Viewers can only read. Members create their own tasks. Owners control everything.',
              color: '#8b5cf6',
            },
          ].map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="glass-card" style={{
                padding: 'var(--space-8)', borderRadius: 'var(--radius-xl)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                animationDelay: `${i * 100}ms`,
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 40px rgba(0,0,0,0.3)`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '';
                }}
              >
                <div style={{
                  width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
                  background: `${feature.color}20`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-5)',
                }}>
                  <Icon size={22} color={feature.color} />
                </div>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
                  {feature.title}
                </h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stats Bar */}
      <section style={{
        padding: 'var(--space-16) var(--space-8)',
        background: 'rgba(99, 102, 241, 0.04)',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          maxWidth: '900px', margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-8)',
          textAlign: 'center',
        }}>
          {[
            { value: '5 Roles', label: 'Default Roles Built-in' },
            { value: 'REST API', label: 'With Read/Write Scopes' },
            { value: 'Real-time', label: 'Activity Feed' },
            { value: '100%', label: 'Permission-based Access' },
          ].map(stat => (
            <div key={stat.value}>
              <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--brand-400)', marginBottom: 'var(--space-1)' }}>
                {stat.value}
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: 'var(--space-24) var(--space-8)', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-16)' }}>
          <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            Simple to start, <span className="text-gradient">powerful to scale</span>
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          {[
            {
              icon: Target, step: '01',
              title: 'Create a workspace', color: '#6366f1',
              desc: 'Sign up, create your organization, and invite your team. Default roles (Owner, Admin, Manager, Member, Viewer) are ready instantly.',
            },
            {
              icon: GitBranch, step: '02',
              title: 'Set up projects & tasks', color: '#06b6d4',
              desc: 'Create projects to group work. Add tasks with type (Design, Dev, Testing), priority, assignee, due date, and labels.',
            },
            {
              icon: Zap, step: '03',
              title: 'Track & ship faster', color: '#22c55e',
              desc: 'Use the Kanban board, calendar, and analytics to track progress. Connect via REST API to automate workflows.',
            },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.step} style={{
                display: 'flex', gap: 'var(--space-8)', alignItems: 'flex-start',
                padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)',
              }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: 'var(--radius-lg)',
                  background: `${item.color}15`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={26} color={item.color} />
                </div>
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', color: item.color, fontWeight: 700, letterSpacing: '0.08em' }}>
                    STEP {item.step}
                  </span>
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 'var(--space-1) 0 var(--space-2)' }}>
                    {item.title}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: 'var(--space-24) var(--space-8)',
        textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--brand-400)', fontWeight: 600, marginBottom: 'var(--space-4)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Get started today
          </p>
          <h2 style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, marginBottom: 'var(--space-4)',
            lineHeight: 1.15, letterSpacing: '-0.03em',
          }}>
            Join teams who trust <span className="text-gradient">TaskFlow</span>
            <br />to get work done.
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-8)', fontSize: 'var(--text-lg)' }}>
            Free to start. No credit card required.
          </p>
          <Link href="/signup" className="btn btn-primary btn-lg"
            style={{ fontSize: 'var(--text-base)', padding: 'var(--space-4) var(--space-10)' }}>
            Create Free Workspace <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: 'var(--space-8)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: '1200px', margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: 'var(--radius-md)',
            background: 'var(--gradient-brand)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 800, color: 'white',
          }}>T</div>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>TaskFlow</span>
        </div>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
          &copy; {new Date().getFullYear()} TaskFlow. Built for modern teams.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <Link href="/login" style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', textDecoration: 'none' }}>Sign In</Link>
          <Link href="/signup" style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', textDecoration: 'none' }}>Sign Up</Link>
        </div>
      </footer>
    </div>
  );
}
