import {useEffect,useRef,useState} from 'react'
import Home from './pages/Home'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import RestaurantShell from './components/RestaurantShell'
import {getCurrentUser,logout} from './services/api'
import TableMenu from './pages/TableMenu'
import './App.css'
export default function App(){
 const[screen,setScreen]=useState('loading')
 const[user,setUser]=useState(null)
 const[sessionExpired,setSessionExpired]=useState(false)
 const[loginMessage,setLoginMessage]=useState('')
 const lastActivity=useRef(Date.now())
 const lastHeartbeat=useRef(Date.now())
 const tableToken=new URLSearchParams(window.location.search).get('table_token')

 useEffect(()=>{
  if(tableToken){setScreen('table-menu');return}
  getCurrentUser().then(u=>{
   lastActivity.current=Date.now()
   lastHeartbeat.current=Date.now()
   setUser(u)
   setScreen(u.password_change_required?'change-password':'dashboard')
  }).catch(error=>{
   const detail=error.response?.data?.detail
   if(detail==='SESSION_EXPIRED'){setSessionExpired(true);setScreen('login')}
   else setScreen('home')
  })
 },[tableToken])

 useEffect(()=>{
  const onExpired=()=>{setUser(null);setSessionExpired(true);setScreen('login')}
  window.addEventListener('auth:session-expired',onExpired)
  return()=>window.removeEventListener('auth:session-expired',onExpired)
 },[])

 useEffect(()=>{
  if(screen!=='dashboard')return undefined
  lastActivity.current=Date.now()
  lastHeartbeat.current=Date.now()
  const markActivity=()=>{lastActivity.current=Date.now()}
  const events=['mousemove','keydown','click','touchstart']
  events.forEach(event=>window.addEventListener(event,markActivity,{passive:true}))
  const timer=window.setInterval(async()=>{
   const now=Date.now()
   if(now-lastActivity.current>=30*60*1000){
    setUser(null);setSessionExpired(true);setScreen('login')
    return
   }
   if(now-lastHeartbeat.current>=5*60*1000&&now-lastActivity.current<5*60*1000){
    lastHeartbeat.current=now
    try{await getCurrentUser()}catch(error){
     if(error.response?.status===401){setUser(null);setSessionExpired(true);setScreen('login')}
    }
   }
  },60*1000)
  return()=>{
   events.forEach(event=>window.removeEventListener(event,markActivity))
   window.clearInterval(timer)
  }
 },[screen])

 async function signout(){
  try{await logout()}finally{setUser(null);setSessionExpired(false);setScreen('home')}
 }

 if(screen==='loading')return <div className="app-loading"><div className="loading-mark">R</div><span>Đang mở hệ thống...</span></div>
 if(screen==='table-menu')return <TableMenu token={tableToken}/>
 if(screen==='home')return <Home onLogin={()=>{setSessionExpired(false);setScreen('login')}}/>
 if(screen==='login')return <Login expired={sessionExpired} onBack={()=>setScreen('home')} onSuccess={u=>{lastActivity.current=Date.now();lastHeartbeat.current=Date.now();setUser(u);setSessionExpired(false);setLoginMessage(u.password_change_required?'':'Đăng nhập thành công.');setScreen(u.password_change_required?'change-password':'dashboard')}}/>
 if(screen==='change-password')return <ChangePassword onLogout={signout} onComplete={()=>{setUser(null);setScreen('login')}}/>
 return <RestaurantShell user={user} loginMessage={loginMessage} onLogout={signout}/>
}
