import { useState } from 'react'
import { SECTION_TYPES } from '../data/sections.js'
import {
  findPage,
  findSection,
  updateBusiness,
  updateSetting,
  updateSectionProp,
  updateSectionItem,
  addSection,
  removeSection,
  moveSection,
} from '../lib/siteUpdates.js'

function sectionSub(block) {
  const meta = SECTION_TYPES[block.type]
  if (!meta) return block.type
  return typeof meta.sub === 'function' ? meta.sub(block.props) : meta.sub
}

function DomainSettings({ site, online, onSetDomain, onVerifyDomain, onRemoveDomain }) {
  const [domainInput, setDomainInput] = useState('')
  const [setup, setSetup] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (online !== true) {
    return (
      <div className="field-group">
        <label>Custom domain</label>
        <p className="domain-hint">Connect the API to attach your own domain.</p>
      </div>
    )
  }

  const active = site.customDomain

  const connect = async () => {
    const domain = domainInput.trim()
    if (!domain) return
    setBusy(true)
    setError(null)
    try {
      const result = await onSetDomain(domain)
      setSetup(result)
    } catch (e) {
      setError(e.message)
      setSetup(null)
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setBusy(true)
    setError(null)
    try {
      await onVerifyDomain()
      setSetup(null)
      setDomainInput('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await onRemoveDomain()
      setSetup(null)
      setDomainInput('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field-group">
      <label>Custom domain</label>
      {active && (
        <div className="domain-active">
          <span className="status-pill"><i /> {active}</span>
          <button className="section-btn remove" onClick={remove} disabled={busy} aria-label="Remove domain">×</button>
        </div>
      )}
      {!active && !setup && (
        <div className="domain-row">
          <input
            placeholder="example.com"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
          />
          <button className="dark-button" onClick={connect} disabled={busy}>Connect</button>
        </div>
      )}
      {setup && (
        <div className="domain-records">
          <p className="domain-hint">Add this TXT record at your DNS provider, then verify.</p>
          <div className="record"><code>{setup.txtName}</code><code>{setup.txtValue}</code></div>
          <button className="dark-button" onClick={verify} disabled={busy}>Verify ownership</button>
        </div>
      )}
      {error && <p className="domain-error">{error}</p>}
    </div>
  )
}

export default function EditorPanel({ site, online, saveState, onUpdate, onSetDomain, onVerifyDomain, onRemoveDomain }) {
  const page = findPage(site)
  const hero = findSection(page, 'hero')
  const services = findSection(page, 'services')

  const handleAddSection = (type) => onUpdate(addSection(site, page.id, SECTION_TYPES[type].create()))
  const handleRemoveSection = (blockId) => onUpdate(removeSection(site, page.id, blockId))
  const handleMoveSection = (blockId, direction) => onUpdate(moveSection(site, page.id, blockId, direction))

  const addable = Object.entries(SECTION_TYPES).filter(([type]) => !findSection(page, type))

  const savedLabel = saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved'

  return (
    <aside className="editor-panel">
      <div className="panel-heading">
        <div>
          <p className="overline">Site editor</p>
          <h2>Homepage</h2>
        </div>
        <span className="saved"><i /> {savedLabel}</span>
      </div>

      <div className="panel-scroll">
        <div className="field-group">
          <label>Business name</label>
          <input
            value={site.business.name}
            onChange={(e) => onUpdate(updateBusiness(site, { name: e.target.value }))}
          />
        </div>

        {hero && (
          <>
            <div className="field-group">
              <label>Headline <span className="field-type">hero.headline</span></label>
              <textarea rows="3" value={hero.props.headline} onChange={(e) => onUpdate(updateSectionProp(site, page.id, hero.id, 'headline', e.target.value))} />
            </div>

            <div className="field-group">
              <label>Short description <span className="field-type">hero.description</span></label>
              <textarea rows="3" value={hero.props.description} onChange={(e) => onUpdate(updateSectionProp(site, page.id, hero.id, 'description', e.target.value))} />
            </div>

            <div className="field-row">
              <div className="field-group">
                <label>Primary button</label>
                <input value={hero.props.primaryCta} onChange={(e) => onUpdate(updateSectionProp(site, page.id, hero.id, 'primaryCta', e.target.value))} />
              </div>
              <div className="field-group">
                <label>Accent color</label>
                <div className="color-input">
                  <input type="color" value={site.settings.accent} onChange={(e) => onUpdate(updateSetting(site, 'accent', e.target.value))} />
                  <span>{site.settings.accent}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {services && services.props.items.map((item, i) => (
          <div className="field-group service-fields" key={item.id}>
            <label>Service {i + 1} <span className="field-type">services.items</span></label>
            <input
              value={item.title}
              onChange={(e) => onUpdate(updateSectionItem(site, page.id, services.id, item.id, 'title', e.target.value))}
            />
            <textarea
              rows="2"
              value={item.description}
              onChange={(e) => onUpdate(updateSectionItem(site, page.id, services.id, item.id, 'description', e.target.value))}
            />
          </div>
        ))}

        <div className="content-divider" />

        <div className="section-title">
          <span>Homepage sections</span>
        </div>

        {page.sections.map((block, i) => {
          const meta = SECTION_TYPES[block.type]
          return (
            <div className="section-card" key={block.id}>
              <div className="drag" aria-hidden="true">⠿</div>
              <div className="section-card-body">
                <strong>{meta ? meta.label : block.type}</strong>
                <small>{sectionSub(block)}</small>
              </div>
              <div className="section-actions">
                <button
                  type="button"
                  className="section-btn"
                  aria-label="Move section up"
                  disabled={i === 0}
                  onClick={() => handleMoveSection(block.id, -1)}
                >↑</button>
                <button
                  type="button"
                  className="section-btn"
                  aria-label="Move section down"
                  disabled={i === page.sections.length - 1}
                  onClick={() => handleMoveSection(block.id, 1)}
                >↓</button>
                <button
                  type="button"
                  className="section-btn remove"
                  aria-label="Remove section"
                  onClick={() => handleRemoveSection(block.id)}
                >×</button>
              </div>
            </div>
          )
        })}

        {addable.map(([type, meta]) => (
          <div className="section-card muted-card" key={type}>
            <div className="drag" aria-hidden="true">+</div>
            <div className="section-card-body">
              <strong>{meta.label}</strong>
              <small>{meta.hint}</small>
            </div>
            <button type="button" className="add-small" onClick={() => handleAddSection(type)}>Add</button>
          </div>
        ))}

        <div className="content-divider" />

        <DomainSettings
          site={site}
          online={online}
          onSetDomain={onSetDomain}
          onVerifyDomain={onVerifyDomain}
          onRemoveDomain={onRemoveDomain}
        />
      </div>
    </aside>
  )
}
