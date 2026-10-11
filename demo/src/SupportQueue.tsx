import { useEffect, useState } from 'react';

interface Ticket {
  id: number;
  subject: string;
  customer: string;
  priority: 'Urgent' | 'High' | 'Normal' | 'Low';
  minutesAgo: number;
}

const TICKETS: Ticket[] = [
  {
    id: 4821,
    subject: 'Refund not showing on card statement',
    customer: 'Priya Natarajan',
    priority: 'High',
    minutesAgo: 4,
  },
  {
    id: 4820,
    subject: 'Cannot export invoices to CSV',
    customer: 'Tomás Rivera',
    priority: 'Normal',
    minutesAgo: 12,
  },
  {
    id: 4818,
    subject: 'SSO sign-in loops back to the login page',
    customer: 'Grace Okafor',
    priority: 'Urgent',
    minutesAgo: 26,
  },
  {
    id: 4815,
    subject: 'Change the billing contact email',
    customer: 'Malik Aziz',
    priority: 'Low',
    minutesAgo: 64,
  },
  {
    id: 4811,
    subject: 'Webhook retries arrive twice',
    customer: 'Sofia Lindqvist',
    priority: 'Normal',
    minutesAgo: 131,
  },
];

/** Daily ticket volume for the last 14 days. */
const VOLUME = [31, 28, 35, 40, 33, 22, 18, 30, 37, 41, 36, 29, 24, 33];

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('');
}

function formatClock(date: Date): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function formatMinutes(minutes: number): string {
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
}

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function Sparkline() {
  const max = Math.max(...VOLUME);
  const points = VOLUME.map((value, index) => {
    const x = (index / (VOLUME.length - 1)) * 100;
    const y = 28 - (value / max) * 24;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg
      className="sparkline"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      role="img"
      aria-label="Ticket volume over the last 14 days"
    >
      <polyline points={points} />
    </svg>
  );
}

export function SupportQueue() {
  const now = useClock();
  // Changes from visit to visit, so the live app visibly brings fresher data than the frame.
  const openCount = 20 + (now.getMinutes() % 9);

  return (
    <section className="screen" aria-label="Example app: a support queue">
      <header className="screen-header">
        <div>
          <p className="screen-product">Helpdesk</p>
          <h2>Support queue</h2>
        </div>
        <p className="clock">
          <span className="frame-badge">Frame</span>
          <time dateTime={now.toISOString()}>{formatClock(now)}</time>
        </p>
      </header>

      <dl className="screen-stats">
        <div>
          <dt>Open</dt>
          <dd>{openCount}</dd>
        </div>
        <div>
          <dt>Waiting on customer</dt>
          <dd>9</dd>
        </div>
        <div>
          <dt>Median first reply</dt>
          <dd>14m</dd>
        </div>
        <div className="screen-volume">
          <dt>Volume, 14 days</dt>
          <dd>
            <Sparkline />
          </dd>
        </div>
      </dl>

      <ul className="tickets">
        {TICKETS.map((ticket) => (
          <li key={ticket.id} className="ticket">
            <span className="avatar" aria-hidden="true">
              {initials(ticket.customer)}
            </span>
            <span className="ticket-main">
              <span className="ticket-subject">{ticket.subject}</span>
              <span className="ticket-meta">
                #{ticket.id}, {ticket.customer}
              </span>
            </span>
            <span className={`priority is-${ticket.priority.toLowerCase()}`}>
              {ticket.priority}
            </span>
            <span className="ticket-age">{formatMinutes(ticket.minutesAgo)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
