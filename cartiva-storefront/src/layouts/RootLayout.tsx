import { Outlet } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function RootLayout() {
  return (
    <div className="min-h-screen bg-[#F8F7F6] text-zinc-900 flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1180px] w-full mx-auto px-4 sm:px-6 lg:px-7 py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
