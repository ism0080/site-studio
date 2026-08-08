import { useCallback, useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { api } from '../lib/api.js'

export default function Leads({ site, online, onEdit }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setLeads(await api.listLeads(site.id))
    } catch (e) {
      setError(e.message)
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [site.id])

  useEffect(() => {
    if (online && site.id) load()
  }, [online, site.id, load])

  const remove = async (leadId) => {
    try {
      await api.deleteLead(site.id, leadId)
      setLeads((list) => list.filter((lead) => lead.id !== leadId))
    } catch (e) {
      setError(e.message)
    }
  }

  if (!site.id || !online) {
    return (
      <div className="empty-page">
        <div className="empty-icon"><Icon name="users" size={28} /></div>
        <h2>Your leads, in one place</h2>
        <p>When visitors reach out through your site, their inquiries will appear here.</p>
        <button className="dark-button" onClick={onEdit}>Customize your site <Icon name="arrow" size={16} /></button>
      </div>
    )
  }

  return (
    <div className="leads-page">
      <div className="section-header">
        <div>
          <p className="overline">Leads</p>
          <h2>{site.business.name} — new inquiries</h2>
        </div>
        <button className="light-button" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="conn-banner error"><span>{error}</span></div>}

      {leads.length === 0 && !loading ? (
        <div className="empty-page empty-leads">
          <div className="empty-icon"><Icon name="users" size={28} /></div>
          <h2>No leads yet</h2>
          <p>Add a contact form to your site — messages from visitors will show up here.</p>
          <button className="dark-button" onClick={onEdit}>Open editor <Icon name="arrow" size={16} /></button>
        </div>
      ) : (
        <div className="lead-list">
          {leads.map((lead) => (
            <div className="lead-card" key={lead.id}>
              <div className="lead-body">
                <div className="lead-head">
                  <strong>{lead.name}</strong>
                  <a href={`mailto:${lead.email}`}>{lead.email}</a>
                </div>
                {lead.message && <p>{lead.message}</p>}
                <small>{new Date(lead.createdAt).toLocaleString()}</small>
              </div>
              <button className="section-btn remove" onClick={() => remove(lead.id)} aria-label="Delete lead">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
