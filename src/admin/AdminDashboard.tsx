import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from './auth/AdminAuthContext';
import { EventsManager } from './EventsManager';
import CandidateLinksPanel from './CandidateLinksPanel';
import { listEvents } from './events-service';

/**
 * Admin dashboard.
 *
 * Mounted lazily and only ever rendered by <Outlet /> inside the guard, so its
 * module is not even fetched before credentials pass. Any future admin data
 * fetching belongs here (or in child routes) — never in the guard, the login
 * screen or the MFA screen.
 */
export default function AdminDashboard() {
  const { email, signOut, busy } = useAdminAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<Array<{ id: string; event_code: string; date?: string | null }>>([]);
  const [eventLoadError, setEventLoadError] = useState<string | null>(null);

  // Keep search engines from indexing the admin area.
  useEffect(() => {
    const meta = document.querySelector('meta[name="robots"]');
    if (meta) {
      meta.setAttribute('content', 'noindex, nofollow');
    } else {
      const el = document.createElement('meta');
      el.name = 'robots';
      el.content = 'noindex, nofollow';
      document.head.appendChild(el);
    }
  }, []);

  useEffect(() => {
    void listEvents()
      .then((rows: Array<{ id: string; event_code: string; date?: string | null }>) => {
        setEventLoadError(null);
        setEvents(rows);
        setSelectedEventId((current) => {
          if (current && rows.some((row) => row.id === current)) return current;
          return rows[0]?.id ?? null;
        });
      })
      .catch((error: unknown) => {
        setEventLoadError(error instanceof Error ? error.message : 'Failed to load events.');
      });
  }, []);

  const adminPath = import.meta.env.VITE_ADMIN_PATH || '/nbn-admin';
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  return (
    <div className='admin-shell min-h-screen bg-background text-foreground'>
      {/* ── top nav ── */}
      <header className='sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm'>
        <div className='mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6'>
          {/* brand */}
          <div className='flex min-w-0 flex-col'>
            <span className='text-sm font-bold tracking-tight text-foreground'>NBN Admin</span>
            {email ? (
              <span className='hidden truncate text-xs text-muted-foreground sm:block'>{email}</span>
            ) : null}
          </div>

          {/* desktop nav */}
          <nav className='hidden items-center gap-2 sm:flex'>
            <Link
              to={`${adminPath}/registrations`}
              className='flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted'
            >
              <span className='icon' style={{ fontSize: 16 }}>list_alt</span>
              Registrations
            </Link>
            <button
              type='button'
              onClick={() => void signOut()}
              disabled={busy}
              className='flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive shadow-sm transition-colors hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60'
            >
              <span className='icon' style={{ fontSize: 16 }}>logout</span>
              {busy ? 'Signing out…' : 'Log out'}
            </button>
          </nav>

          {/* mobile hamburger */}
          <button
            type='button'
            className='flex items-center rounded-md border border-border p-2 sm:hidden'
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label='Toggle menu'
          >
            <span className='icon' style={{ fontSize: 20 }}>
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>

        {/* mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className='border-t border-border bg-card px-4 py-3 sm:hidden'>
            {email ? (
              <p className='mb-3 truncate text-xs text-muted-foreground'>{email}</p>
            ) : null}
            <div className='flex flex-col gap-2'>
              <Link
                to={`${adminPath}/registrations`}
                onClick={() => setMobileMenuOpen(false)}
                className='flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium'
              >
                <span className='icon' style={{ fontSize: 16 }}>list_alt</span>
                Registrations
              </Link>
              <button
                type='button'
                onClick={() => { setMobileMenuOpen(false); void signOut(); }}
                disabled={busy}
                className='flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive disabled:opacity-60'
              >
                <span className='icon' style={{ fontSize: 16 }}>logout</span>
                {busy ? 'Signing out…' : 'Log out'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── main content ── */}
      <main className='mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8'>
        <div>
          <h2 className='text-lg font-semibold tracking-tight'>Event management</h2>
          <p className='mt-0.5 text-sm text-muted-foreground'>
            Create and configure events for matchmaking registration.
          </p>
        </div>

        {eventLoadError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
            <p role='alert'>Could not load the event selector: {eventLoadError}</p>
            <button type='button' onClick={() => {
              setEventLoadError(null);
              void listEvents().then((rows) => {
                setEvents(rows);
                setSelectedEventId((current) => current && rows.some((row) => row.id === current)
                  ? current
                  : rows[0]?.id ?? null);
              }).catch((error: unknown) => {
                setEventLoadError(error instanceof Error ? error.message : 'Failed to load events.');
              });
            }} className='mt-2 rounded-md border border-destructive/40 px-3 py-1.5 font-medium'>
              Retry
            </button>
          </div>
        ) : events.length > 0 ? (
          <div className='rounded-md border border-border bg-card p-3'>
            <label htmlFor='selected-event' className='mb-2 block text-sm font-medium text-foreground'>
              Event for candidate links and requests
            </label>
            <select
              id='selected-event'
              value={selectedEventId ?? ''}
              onChange={(event) => setSelectedEventId(event.target.value || null)}
              className='w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 sm:max-w-md'
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.event_code} {event.date ? `• ${event.date}` : ''}
                </option>
              ))}
            </select>
            {selectedEvent ? (
              <p className='mt-2 text-xs text-muted-foreground'>
                Generating candidate links for {selectedEvent.event_code}
                {selectedEvent.date ? ` on ${selectedEvent.date}` : ''}
              </p>
            ) : null}
          </div>
        ) : null}

        <EventsManager onEventSaved={(saved) => {
          setEvents((previous) => previous.some((event) => event.id === saved.id)
            ? previous.map((event) => event.id === saved.id
              ? { ...event, event_code: saved.event_code, date: saved.date }
              : event)
            : [{ id: saved.id, event_code: saved.event_code, date: saved.date }, ...previous]);
          setSelectedEventId(saved.id);
        }} />
        <section className='space-y-3'>
          <div>
            <h2 className='text-lg font-semibold tracking-tight'>Candidate links and interest requests</h2>
            <p className='mt-0.5 text-sm text-muted-foreground'>
              Requests show candidate interest activity; they are not scheduled or booked meetings.
            </p>
          </div>
        {selectedEventId ? (
            <CandidateLinksPanel
              eventId={selectedEventId}
              eventLabel={selectedEvent ? `${selectedEvent.event_code}${selectedEvent.date ? ` · ${selectedEvent.date}` : ''}` : 'selected event'}
            />
        ) : (
          <p className='text-sm text-muted-foreground'>Create an event before generating candidate links.</p>
        )}
        </section>
      </main>
    </div>
  );
}
