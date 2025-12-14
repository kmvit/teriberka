import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import TripDetail from './pages/TripDetail'
import Register from './pages/profile/Register'
import Login from './pages/profile/Login'
import Profile from './pages/profile/Profile'
import Bookings from './pages/profile/Bookings'
import Finances from './pages/profile/Finances'
import Calendar from './pages/profile/Calendar'
import MyBoats from './pages/profile/MyBoats'
import ForgotPassword from './pages/profile/ForgotPassword'
import ResetPassword from './pages/profile/ResetPassword'
import VerifyEmail from './pages/profile/VerifyEmail'
import Verification from './pages/profile/Verification'
import BlogList from './pages/BlogList'
import BlogDetail from './pages/BlogDetail'
import './App.css'

function App() {
  return (
    <Router>
      <div className="fixed-crossbrowser-background"></div>
      <div className="app">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trips/:tripId" element={<TripDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/bookings" element={<Bookings />} />
          <Route path="/profile/finances" element={<Finances />} />
          <Route path="/profile/calendar" element={<Calendar />} />
          <Route path="/profile/boats" element={<MyBoats />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/profile/verification" element={<Verification />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogDetail />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  )
}

export default App

