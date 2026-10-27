import { useEffect, useMemo, useState } from 'react';
import {
  downloadCsv,
  generateLinksForEvent,
  listCandidateLinkRows,
  listRequestPairs,
  regenerateLink,
  resetLinkLock,
  revokeLink,
  type CandidateLinkRow,
  type RequestPairRow,
} from './candidate-links';

const buttonClass = 'rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm hover:opacity-90';
const dangerClass = 'rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive shadow-sm hover:opacity-90';

function CandidateLinksPanel({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<CandidateLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState<Array<{ registration_id: string; candidate_code: string; gender: string; token: string }>>([]);
  const [requestRows, setRequestRows] = useState<RequestPairRow[]>([]);
  const [requestFilter, setRequestFilter] = useState<'all' | 'mutual' | 'sent' | 'withdrawn'>('all');
  const [linkFilter, setLinkFilter] = useState<'all' | 'active' | 'no_link' | 'revoked' | 'locked'>('all');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [linkRows, requestPairs] = await Promise.all([
        listCandidateLinkRows(eventId),
        listRequestPairs(eventId),
      ]);
      setRows(linkRows);
      setRequestRows(requestPairs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load candidate links.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) void loadData();
  }, [eventId]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => linkFilter === 'all' || row.link_status === linkFilter);
  }, [rows, linkFilter]);

  const filteredRequests = useMemo(() => {
    return requestRows.filter((row) => {
      if (requestFilter === 'all') return true;
      if (requestFilter === 'mutual') return !!row.is_mutual;
      return row.status === requestFilter;
    });
  }, [requestRows, requestFilter]);

  const handleGenerateLinks = async () => {
    try {
      const result = await generateLinksForEvent(eventId);
      setGeneratedLinks(result.map((row) => ({
        registration_id: row.out_registration_id,
        candidate_code: row.out_candidate_code,
        gender: row.out_gender,
        token: row.out_token,
      })));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate links.');
    }
  };

  const handleRegenerate = async (registrationId: string) => {
    try {
      const token = await regenerateLink(registrationId);
      setGeneratedLinks([{ registration_id: registrationId, candidate_code: 'regenerated', gender: 'n/a', token }]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate link.');
    }
  };

  const handleRevoke = async (registrationId: string) => {
    try {
      await revokeLink(registrationId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke link.');
    }
  };

  const handleResetLock = async (registrationId: string) => {
    try {
      await resetLinkLock(registrationId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset lock.');
    }
  };

  const handleExport = () => {
    downloadCsv(
      requestRows.map((row) => ({
        from_code: row.from_code,
        to_code: row.to_code,
        status: row.status,
        created_at: row.created_at,
        is_mutual: row.is_mutual ? 'yes' : 'no',
      })),
      'candidate-requests.csv',
    );
  };

  return (
    <div className='space-y-6'>
      <div className='rounded-md border border-border bg-card p-4'>
        <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
          <h3 className='text-lg font-semibold'>Candidate links</h3>
          <button type='button' onClick={handleGenerateLinks} className={buttonClass}>Generate links</button>
        </div>

        {generatedLinks.length > 0 && (
          <div className='mb-4 space-y-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3'>
            {generatedLinks.map((link) => (
              <div key={link.registration_id + link.token} className='flex flex-col gap-2 rounded-md bg-background p-2 sm:flex-row sm:items-center sm:justify-between'>
                <div className='font-mono text-xs break-all'>
                  {link.candidate_code}: {window.location.origin}/v/{link.token}
                </div>
                <div className='flex gap-2'>
                  <button
                    type='button'
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/v/${link.token}`)}
                    className={buttonClass}
                  >
                    Copy
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${window.location.origin}/v/${link.token}`)}`}
                    target='_blank'
                    rel='noreferrer'
                    className={buttonClass}
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <div className='mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive'>{error}</div>}

        <div className='mb-3 flex flex-wrap gap-2'>
          {(['all', 'active', 'no_link', 'revoked', 'locked'] as const).map((value) => (
            <button key={value} type='button' onClick={() => setLinkFilter(value)} className={buttonClass}>
              {value === 'all' ? 'All' : value}
            </button>
          ))}
        </div>

        {loading ? (
          <p className='text-sm text-muted-foreground'>Loading candidate links…</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='min-w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-border'>
                  <th className='px-2 py-2'>Code</th>
                  <th className='px-2 py-2'>Gender</th>
                  <th className='px-2 py-2'>Phone</th>
                  <th className='px-2 py-2'>Status</th>
                  <th className='px-2 py-2'>Last used</th>
                  <th className='px-2 py-2'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.registration_id} className='border-b border-border/60'>
                    <td className='px-2 py-2 font-mono'>{row.candidate_code ?? '—'}</td>
                    <td className='px-2 py-2'>{row.gender ?? '—'}</td>
                    <td className='px-2 py-2'>{row.phone ?? 'Missing'}</td>
                    <td className='px-2 py-2'>
                      <span className='rounded-full border border-border px-2 py-0.5 text-xs capitalize'>
                        {row.link_status}
                      </span>
                    </td>
                    <td className='px-2 py-2'>{row.last_used_at ? new Date(row.last_used_at).toLocaleString() : '—'}</td>
                    <td className='px-2 py-2'>
                      <div className='flex flex-wrap gap-2'>
                        <button type='button' onClick={() => handleRegenerate(row.registration_id)} className={buttonClass}>Regenerate</button>
                        <button type='button' onClick={() => handleRevoke(row.registration_id)} className={dangerClass}>Revoke</button>
                        <button type='button' onClick={() => handleResetLock(row.registration_id)} className={buttonClass}>Reset lock</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className='rounded-md border border-border bg-card p-4'>
        <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
          <h3 className='text-lg font-semibold'>Requests</h3>
          <button type='button' onClick={handleExport} className={buttonClass}>Export Excel</button>
        </div>

        <div className='mb-3 flex flex-wrap gap-2'>
          {(['all', 'mutual', 'sent', 'withdrawn'] as const).map((value) => (
            <button key={value} type='button' onClick={() => setRequestFilter(value)} className={buttonClass}>
              {value === 'all' ? 'All' : value === 'mutual' ? 'Mutual' : value}
            </button>
          ))}
        </div>

        <div className='overflow-x-auto'>
          <table className='min-w-full text-left text-sm'>
            <thead>
              <tr className='border-b border-border'>
                <th className='px-2 py-2'>From</th>
                <th className='px-2 py-2'>To</th>
                <th className='px-2 py-2'>Status</th>
                <th className='px-2 py-2'>Mutual</th>
                <th className='px-2 py-2'>Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((row) => (
                <tr key={`${row.from_code}-${row.to_code}-${row.created_at}`} className='border-b border-border/60'>
                  <td className='px-2 py-2 font-mono'>{row.from_code}</td>
                  <td className='px-2 py-2 font-mono'>{row.to_code}</td>
                  <td className='px-2 py-2 capitalize'>{row.status}</td>
                  <td className='px-2 py-2'>{row.is_mutual ? 'Yes' : 'No'}</td>
                  <td className='px-2 py-2'>{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CandidateLinksPanel;
