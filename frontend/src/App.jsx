import {useEffect,useState} from 'react'
import Home from './pages/Home'
import QuetQR from './pages/QuetQR'
import Login from './pages/Login'
import RestaurantShell from './components/RestaurantShell'
import {getCurrentUser} from './services/api'
import './App.css'
export default function App(){const token=new URLSearchParams(window.location.search).get('qr');return token!==null?<QuetQR token={token}/>:<AuthenticatedApp/>}
function AuthenticatedApp(){const[screen,setScreen]=useState('loading'),[user,setUser]=useState(null);useEffect(()=>{getCurrentUser().then(u=>{setUser(u);setScreen('dashboard')}).catch(()=>setScreen('home'))},[]);if(screen==='loading')return <div className="app-loading"><div className="loading-mark">R</div><span>Đang mở hệ thống...</span></div>;if(screen==='home')return <Home onLogin={()=>setScreen('login')}/>;if(screen==='login')return <Login onBack={()=>setScreen('home')} onSuccess={u=>{setUser(u);setScreen('dashboard')}}/>;return <RestaurantShell user={user} onLogout={()=>{setUser(null);setScreen('home')}}/>}
