import { memo } from 'react'
import { Streamdown } from 'streamdown'
import { BlobAvatar } from '../blob-avatar'
import { ShapeAvatar } from './ShapeAvatar'
import { AgentHoverCard } from './AgentHoverCard'
import { ReasoningChain } from './ReasoningChain'
import { TaskCard } from './TaskCard'
import type { Message, AgentState, AgentTask } from '../types'

export const ChatMessage = memo(({ m, sameSender, agentState, userAvatarUrl, onApproveProposal, onRejectProposal, onAddTask, onDismissTask }: {
  m: Message, sameSender: boolean, agentState?: AgentState | null, userAvatarUrl?: string,
  onApproveProposal?: (id: string) => void, onRejectProposal?: (id: string) => void,
  onAddTask?: (task: Pick<AgentTask, 'title' | 'assignedAgents' | 'sectionAnchor'>) => void,
  onDismissTask?: () => void,
}) => {
  const isAgent = m.from !== 'You' && m.from !== 'Sarah' && m.from !== 'System'
  const displayText = m.text.replace('[from doc] ', '')
  return (
    <div className={`msg ${isAgent ? 'msg-agent' : 'msg-human'} ${sameSender ? 'msg-consecutive' : ''}`} data-agent={isAgent ? m.from.toLowerCase() : undefined}>
      {!sameSender && (
        <div className={`msg-avatar ${isAgent ? 'msg-avatar-agent' : ''}`}>
          {isAgent ? (
            <>
              <BlobAvatar name={m.from} size={26} />
              <AgentHoverCard name={m.from} agentState={agentState ?? null} />
            </>
          ) : m.from === 'You' ? (
            userAvatarUrl ? (
              <img src={userAvatarUrl} alt="You" className="user-avatar" width={26} height={26} />
            ) : (
              <div className="user-avatar user-avatar-fallback" style={{ width: 26, height: 26 }} />
            )
          ) : (
            <ShapeAvatar name={m.from} size={26} />
          )}
        </div>
      )}
      <div className={`msg-body ${sameSender ? 'msg-body-consecutive' : ''}`}>
        {!sameSender && (
          <div className="msg-header">
            <span className="msg-name">{m.from}</span>
            <span className="msg-time">{m.time}</span>
          </div>
        )}
        {sameSender && <span className="msg-time-hover">{m.time}</span>}
        {isAgent && m.reasoning && m.reasoning.length > 0 && (
          <ReasoningChain steps={m.reasoning} />
        )}
        <div className="msg-text msg-markdown">
          <Streamdown>{displayText}</Streamdown>
        </div>
        {m.proposal?.type === 'edit' && (
          <div className="msg-edit-preview" aria-label="Proposed document change">
            {m.proposal.edit.kind === 'replace' && (
              <>
                <div className="msg-edit-label">Remove</div>
                <pre className="msg-edit-block msg-edit-remove">{m.proposal.edit.beforeText || '(empty)'}</pre>
                <div className="msg-edit-label">Add</div>
                <pre className="msg-edit-block msg-edit-add">{m.proposal.edit.afterText}</pre>
              </>
            )}
            {m.proposal.edit.kind === 'insert' && (
              <>
                {m.proposal.edit.target && (
                  <div className="msg-edit-meta">Position: {m.proposal.edit.target}</div>
                )}
                <div className="msg-edit-label">Add</div>
                <pre className="msg-edit-block msg-edit-add">{m.proposal.edit.afterText}</pre>
              </>
            )}
            {m.proposal.edit.kind === 'delete' && (
              <>
                <div className="msg-edit-label">Remove</div>
                <pre className="msg-edit-block msg-edit-remove">{m.proposal.edit.beforeText || ''}</pre>
              </>
            )}
            {m.proposal.edit.sources && m.proposal.edit.sources.length > 0 && (
              <div className="msg-edit-sources">
                <span className="msg-edit-label">Sources</span>
                <ul>
                  {m.proposal.edit.sources.map((s, i) => (
                    <li key={i}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a>
                      {s.quote ? <span className="msg-edit-quote"> {s.quote.slice(0, 120)}{s.quote.length > 120 ? '…' : ''}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {m.proposal && m.proposal.status === 'pending' && (
          <div className="msg-proposal-actions">
            <button type="button"
              className="msg-proposal-btn msg-proposal-approve"
              onClick={() => onApproveProposal?.(m.id)}
            >{m.proposal.type === 'edit' ? 'Apply' : 'Approve'}</button>
            <button type="button"
              className="msg-proposal-btn msg-proposal-reject"
              onClick={() => onRejectProposal?.(m.id)}
            >Dismiss</button>
          </div>
        )}
        {m.proposal && m.proposal.status === 'approved' && (
          <span className="msg-proposal-status">Approved</span>
        )}
        {m.proposal && m.proposal.status === 'rejected' && (
          <span className="msg-proposal-status msg-proposal-dismissed">Dismissed</span>
        )}
        {m.taskEvent && (
          <TaskCard event={m.taskEvent} onAdd={onAddTask} onDismiss={onDismissTask} />
        )}
      </div>
    </div>
  )
})
