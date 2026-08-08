import Icon from './Icon.jsx'

const HEADINGS = {
  overview: ['Good morning, Jordan', 'Here’s what’s happening with your sites.'],
  editor: ['Edit your site', 'Make updates, see them live.'],
  templates: ['Templates', 'A starting point for every kind of business.'],
  leads: ['Leads', 'Keep track of new opportunities.'],
}

const statusLabel = (status) => (status === 'published' ? 'Published' : 'Draft')

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

export default function Header({ active, site, online, saveState, publishing, sites, user, liveUrl, onPublish, onSelectSite }) {
  const [title, subtitle] = HEADINGS[active] || HEADINGS.overview
  const inEditor = active === 'editor'
  return (
    <header className="top-header">
      <div>
        <p className="crumb">
          {inEditor ? `My sites / ${site.business.name}` : 'Workspace'}
          {online === false && <span className="crumb-offline"> · offline demo</span>}
        </p>
        <h1>{title}</h1>
        <p className="header-subtitle">{subtitle}</p>
      </div>
      <div className="header-actions">
        {sites.length > 1 && (
          <select
            className="site-switcher"
            value={site.id}
            onChange={(e) => onSelectSite(e.target.value)}
            aria-label="Switch site"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.business.name}</option>
            ))}
          </select>
        )}
        {liveUrl && <a className="preview-link" href={liveUrl} target="_blank" rel="noreferrer">View live site <Icon name="arrow" size={16} /></a>}
        {inEditor && (
          <button
            className="dark-button publish-button"
            onClick={onPublish}
            disabled={publishing || online === false}
          >
            <Icon name="external" size={15} />
            {publishing ? 'Publishing…' : `Publish · ${statusLabel(site.status)}`}
          </button>
        )}
        <button className="user-avatar" title={user?.email}>{initials(user?.name)}</button>
      </div>
    </header>
  )
}
