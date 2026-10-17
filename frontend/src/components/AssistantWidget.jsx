import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Checkbox, ConfigProvider, Drawer, Empty, Input, Spin, Tabs, Tour } from 'antd'
import { CompassOutlined, DeleteOutlined, MessageOutlined, SendOutlined } from '@ant-design/icons'
import { askAssistant, checkAssistantConnection, getAssistantCatalog } from '../services/assistantApi'
import { SESSION_ENDING_EVENT, SESSION_EXPIRED_EVENT } from '../services/api'
import { buildTour, chatHistory, vietnamToday } from '../utils/assistantTours'
import AssistantDataCard from './AssistantDataCard'
import './AssistantWidget.css'

const THEME = { token: { colorPrimary: '#9f2f27', borderRadius: 10, fontFamily: 'inherit' } }
const MODE_LABELS = { ai: 'Trả lời bằng AI', guide: 'Hướng dẫn có sẵn', data: 'Dữ liệu từ hệ thống', scope: 'Phạm vi hỗ trợ', clarify: 'Cần làm rõ' }

function errorText(error) {
  const detail = error?.response?.data?.detail
  return typeof detail === 'string' ? detail : detail?.message || 'Không kết nối được trợ lý. Vui lòng thử lại.'
}

export default function AssistantWidget({ page, navigation, ready, onNavigate }) {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState(null)
  const [catalogError, setCatalogError] = useState('')
  const [reload, setReload] = useState(0)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('Đang trả lời…')
  const [error, setError] = useState('')
  const [tab, setTab] = useState('chat')
  const [from, setFrom] = useState(vietnamToday)
  const [to, setTo] = useState(vietnamToday)
  const [compare, setCompare] = useState(false)
  const [context, setContext] = useState(null)
  const [historyEnabled, setHistoryEnabled] = useState(true)
  const [connection, setConnection] = useState(null)
  const [tour, setTour] = useState(null)
  const [tourSteps, setTourSteps] = useState(null)
  const requestRef = useRef(null)
  const messageIdRef = useRef(0)
  const bottomRef = useRef(null)
  const allowedPages = navigation.map(item => item.key)

  useEffect(() => {
    if (!open || catalog) return
    const controller = new AbortController()
    getAssistantCatalog(controller.signal).then(data => { setCatalog(data); setCatalogError('') })
      .catch(err => { if (!controller.signal.aborted) setCatalogError(errorText(err)) })
    return () => controller.abort()
  }, [open, catalog, reload])

  useEffect(() => {
    const clear = () => {
      requestRef.current?.abort()
      setMessages([]); setCatalog(null); setOpen(false); setTour(null); setQuestion(''); setBusy(false); setError(''); setContext(null); setHistoryEnabled(true); setConnection(null)
    }
    window.addEventListener(SESSION_ENDING_EVENT, clear)
    window.addEventListener(SESSION_EXPIRED_EVENT, clear)
    return () => {
      requestRef.current?.abort()
      window.removeEventListener(SESSION_ENDING_EVENT, clear)
      window.removeEventListener(SESSION_EXPIRED_EVENT, clear)
    }
  }, [])

  useEffect(() => {
    const log = bottomRef.current?.parentElement
    if (open && log) {
      const latest = bottomRef.current.previousElementSibling
      // Long reports should open at their summary, with the rest available by scrolling.
      const top = latest?.classList.contains('resto-assistant-message--assistant') && latest.offsetHeight > log.clientHeight
        ? latest.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop - 12
        : log.scrollHeight
      log.scrollTo({ top })
    }
  }, [messages, busy, open])

  useEffect(() => {
    if (!tour || page !== tour.page || !ready) return
    let stopped = false
    const started = Date.now()
    let timer
    const poll = () => {
      if (stopped) return
      const definitions = buildTour(tour)
      const missing = definitions.some(step => !document.querySelector(step.selector))
      if (missing && Date.now() - started < 5000) { timer = setTimeout(poll, 150); return }
      setTourSteps(definitions.map((step, index) => ({
        title: step.title,
        description: <div className="resto-assistant-tour-copy">{step.description}{!document.querySelector(step.selector) && <p>Thành phần này chưa sẵn sàng. Hãy đóng hướng dẫn, kiểm tra tải trang và thử lại.</p>}</div>,
        target: () => document.querySelector(step.selector),
        nextButtonProps: { children: index === definitions.length - 1 ? 'Hoàn tất' : 'Tiếp theo' }, prevButtonProps: { children: 'Quay lại' },
      })))
    }
    // Defer until navigation/layout has painted; cleanup on page change/unmount.
    timer = setTimeout(poll, 200)
    return () => { stopped = true; clearTimeout(timer) }
  }, [tour, page, ready])

  function navigate(nextPage) {
    if (!allowedPages.includes(nextPage)) return
    setTour(null); setTourSteps(null); setOpen(false); onNavigate(nextPage)
  }

  function startTour(guide) {
    if (!allowedPages.includes(guide.page)) return
    setTourSteps(null); setTour(guide); setOpen(false)
    if (page !== guide.page) onNavigate(guide.page)
  }

  function stopTour() { setTour(null); setTourSteps(null); setOpen(true) }

  async function checkConnection() {
    if (busy) return
    const controller = new AbortController()
    requestRef.current = controller
    setBusyLabel('Đang kiểm tra kết nối AI…'); setBusy(true); setError('')
    try {
      const result = await checkAssistantConnection(controller.signal)
      if (!controller.signal.aborted) setConnection(result)
    } catch (err) {
      if (!controller.signal.aborted) setError(errorText(err))
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  async function send(extra = {}, label = question) {
    if (busy || (!label.trim() && !extra.guide_id && !extra.data_request)) return
    const controller = new AbortController()
    requestRef.current = controller
    setBusyLabel('Đang trả lời…'); setBusy(true); setError(''); setQuestion(''); setTab('chat')
    const text = label.trim()
    const history = historyEnabled ? chatHistory(messages) : []
    const userMessage = { id: ++messageIdRef.current, role: 'user', content: text }
    setMessages(previous => [...previous, userMessage].slice(-20))
    try {
      const result = await askAssistant({ question: text, page: allowedPages.includes(page) ? page : '', history, context, ...extra }, controller.signal)
      if (!controller.signal.aborted) {
        const assistantMessage = { id: ++messageIdRef.current, role: 'assistant', content: result.answer, result }
        setMessages(previous => [...previous, assistantMessage].slice(-20))
        if (result.data?.request) { setContext(result.data.request); setHistoryEnabled(true) }
        else if (result.context_update) setContext(result.context_update)
      }
    } catch (err) {
      if (!controller.signal.aborted) { setError(errorText(err)); setQuestion(text) }
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  function dataQuery(tool) {
    if (tool.dated && (!from || !to || from > to)) { setError('Chọn khoảng ngày hợp lệ trước khi tra cứu.'); return }
    send({ data_request: { kind: tool.kind, ...(tool.dated ? { start: from, end: to } : {}),
      ...(tool.kind === 'revenue' ? { compare_previous: compare } : {}) } }, tool.title)
  }

  const guides = (catalog?.guides || []).filter(g => allowedPages.includes(g.page))
  const tools = (catalog?.tools || []).filter(t => allowedPages.includes(t.page))
  const suggested = [...guides.filter(g => g.page === page), ...guides.filter(g => g.page !== page)].slice(0, 4)

  return <ConfigProvider theme={THEME}>
    {!tour && <Button className="resto-assistant-launcher" type="primary" icon={<MessageOutlined />} onClick={() => setOpen(true)} aria-label="Mở trợ lý Resto">Trợ lý</Button>}
    {tour && (!tourSteps || page !== tour.page || !ready) && <div className="resto-assistant-tour-wait" role="status">
      {page !== tour.page ? 'Bạn đã chuyển trang.' : !ready ? 'Đang đợi trang tải xong…' : 'Đang chuẩn bị hướng dẫn…'}
      <Button size="small" onClick={stopTour}>Dừng hướng dẫn</Button>
    </div>}
    <Tour open={!!tour && !!tourSteps && page === tour.page && ready} steps={tourSteps || []} onClose={stopTour} onFinish={stopTour}
      disabledInteraction scrollIntoViewOptions={{ block: 'center', behavior: 'smooth' }}
      indicatorsRender={(current, total) => `${current + 1} / ${total}`} />
    <Drawer title={<span className="resto-assistant-title"><MessageOutlined /> Trợ lý Resto</span>} open={open} onClose={() => setOpen(false)}
      rootClassName="resto-assistant-drawer" size={440} styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' } }}
      extra={<Button type="text" icon={<DeleteOutlined />} aria-label="Xóa cuộc trò chuyện" disabled={busy} onClick={() => { setMessages([]); setError(''); setContext(null); setHistoryEnabled(true) }} />}>
      <div className="resto-assistant-status"><span>{catalog?.ai_ready ? 'Đã cấu hình AI · Phân tích theo dữ liệu thật' : 'Chưa cấu hình AI · Các mẫu tra cứu và phân tích vẫn hoạt động'}</span>
        {catalog?.can_check_ai && <Button type="link" size="small" disabled={busy} onClick={checkConnection}>Kiểm tra AI</Button>}
      </div>
      {connection && <Alert type={connection.connected ? 'success' : 'info'} title={connection.message} closable onClose={() => setConnection(null)} />}
      {catalogError && <Alert type="error" title={catalogError} action={<Button size="small" onClick={() => setReload(n => n + 1)}>Thử lại</Button>} />}
      {!catalog && !catalogError && <div className="resto-assistant-loading"><Spin /> Đang tải hướng dẫn…</div>}
      <Tabs activeKey={tab} onChange={setTab} className="resto-assistant-tabs" items={[
        { key: 'chat', label: 'Hỏi đáp', children: <>
          <div className="resto-assistant-conversation" role="log" aria-label="Cuộc trò chuyện" aria-live="polite">
            {!messages.length && <div className="resto-assistant-welcome"><div className="resto-assistant-hero"><span>RESTO · TRỢ LÝ PHÂN TÍCH</span><h3>Từ số liệu đến điều cần kiểm tra.</h3><p>Xem món bán giảm, món hủy, thời gian xử lý và hỏi tiếp theo khoảng ngày đang xem.</p></div>
              <strong className="resto-assistant-group-label">Tra cứu nhanh</strong>
              {(catalog?.query_examples || []).map(text => <Button key={text} disabled={busy} onClick={() => send({}, text)}>{text}</Button>)}
              <strong className="resto-assistant-group-label">Hướng dẫn cho bạn</strong>
              {suggested.slice(0, 2).map(g => <Button key={g.id} disabled={busy} onClick={() => send({ guide_id: g.id }, g.title)}>{g.title}</Button>)}
            </div>}
            {messages.map(message => <article key={message.id} className={`resto-assistant-message resto-assistant-message--${message.role}`}>
              <small>{message.role === 'user' ? 'Bạn' : MODE_LABELS[message.result.mode]}</small>
              {!message.result?.data && <p>{message.content}</p>}
              {message.result?.notice && <p className="resto-assistant-notice">{message.result.notice}</p>}
              {message.result?.sources.map(source => <section key={source.id} className="resto-assistant-source">
                <strong>{source.title}</strong><small className="resto-assistant-source-version">Hướng dẫn Resto · {message.result.version}</small><ol>{source.steps.map(step => <li key={step}>{step}</li>)}</ol>
                <div><Button size="small" onClick={() => navigate(source.page)}>Mở trang</Button><Button size="small" icon={<CompassOutlined />} onClick={() => startTour(source)}>Hướng dẫn trên trang</Button></div>
              </section>)}
              {message.result?.data && <AssistantDataCard data={message.result.data} onNavigate={navigate} busy={busy}
                onRefresh={(request, title) => send({ data_request: request }, `Cập nhật: ${title}`)} />}
              {!!message.result?.suggestions?.length && <div className="resto-assistant-followups">{message.result.suggestions.map(text => <Button key={text} size="small" disabled={busy} onClick={() => send({}, text)}>{text}</Button>)}</div>}
            </article>)}
            {busy && <div className="resto-assistant-loading" role="status"><Spin size="small" /> {busyLabel}</div>}
            <div ref={bottomRef} />
          </div>
          <form className="resto-assistant-compose" onSubmit={event => { event.preventDefault(); send() }}>
            {context && <div className="resto-assistant-context"><span>Đang xem: {tools.find(t => t.kind === context.kind)?.title || context.kind}{context.start ? ` · ${context.start} → ${context.end}` : tools.find(t => t.kind === context.kind)?.dated ? ' · Chờ chọn khoảng ngày' : ' · Hiện tại'}</span><Button type="text" size="small" aria-label="Xóa ngữ cảnh" disabled={busy} onClick={() => { setContext(null); setHistoryEnabled(false) }}>Xóa</Button></div>}
            <label htmlFor="resto-assistant-question">Câu hỏi của bạn</label>
            <Input.TextArea id="resto-assistant-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={2000} autoSize={{ minRows: 2, maxRows: 4 }} placeholder={catalog?.query_examples?.[0] || 'Hỏi về dữ liệu hoặc cách sử dụng hệ thống…'} disabled={busy}
              onPressEnter={event => { if (!event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send() } }} />
            <div><small>Không nhập mật khẩu, khóa API hoặc thông tin riêng tư.</small><Button htmlType="submit" type="primary" icon={<SendOutlined />} disabled={busy || !question.trim()}>Gửi</Button></div>
          </form>
        </> },
        { key: 'data', label: 'Tra cứu dữ liệu', children: <div className="resto-assistant-catalog">
          <p>Tra cứu theo quyền tài khoản. Mỗi kết quả ghi rõ thời điểm lấy dữ liệu.</p>
          {tools.some(t => t.dated) && <div className="resto-assistant-dates"><label>Từ ngày<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Đến ngày<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label><small>Tối đa 92 ngày, theo giờ Việt Nam.</small></div>}
          {tools.some(t => t.kind === 'revenue') && <Checkbox checked={compare} onChange={e => setCompare(e.target.checked)}>So sánh doanh thu với kỳ liền trước, cùng số ngày</Checkbox>}
          {tools.map(tool => <Button block key={tool.kind} disabled={busy} onClick={() => dataQuery(tool)}>{tool.title}{tool.dated ? ' · Theo khoảng ngày' : ''}</Button>)}
          {catalog && !tools.length && <Empty description="Chưa có tra cứu cho vai trò này." />}
        </div> },
        { key: 'guides', label: 'Hướng dẫn', children: <div className="resto-assistant-catalog">
          <p>Chọn chức năng để xem các bước hoặc được chỉ vị trí trực tiếp trên giao diện.</p>
          {guides.map(g => <section className="resto-assistant-guide" key={g.id}><strong>{g.title}</strong><div>
            <Button size="small" disabled={busy} onClick={() => send({ guide_id: g.id }, g.title)}>Xem các bước</Button>
            <Button size="small" icon={<CompassOutlined />} onClick={() => startTour(g)}>Chỉ trên trang</Button>
          </div></section>)}
        </div> },
      ]} />
      {error && <Alert type="error" title={error} closable onClose={() => setError('')} />}
      <div className="resto-assistant-footer">Hướng dẫn tham khảo; bạn kiểm tra và tự xác nhận thao tác trên hệ thống.</div>
    </Drawer>
  </ConfigProvider>
}
