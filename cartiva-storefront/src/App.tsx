import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import RootLayout from './layouts/RootLayout'
import AccountLayout from './layouts/AccountLayout'
import RequireAuth from './components/RequireAuth'
import Home from './pages/Home'
import Catalogue from './pages/Catalogue'
import Search from './pages/Search'
import PaymentCallback from './pages/PaymentCallback'
import ProductDetails from './pages/ProductDetails'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Login from './pages/Login'
import Register from './pages/Register'
import Account from './pages/Account'
import AccountOrders from './pages/account/Orders'
import AccountOrderDetails from './pages/account/OrderDetails'
import AccountAddresses from './pages/account/Addresses'
import AccountWishlist from './pages/account/Wishlist'
import AccountReceipts from './pages/account/Receipts'
import AccountCart from './pages/account/CartAccount'
import AccountReviews from './pages/account/Reviews'
import AccountNotifications from './pages/account/Notifications'
import AccountOffers from './pages/account/Offers'
import AccountSupport from './pages/account/Support'
import AccountProfile from './pages/account/Profile'
import AccountSecurity from './pages/account/Security'
import AccountSettings from './pages/account/Settings'
import RefundPolicy from './pages/RefundPolicy'

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<RootLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/catalogue" element={<Catalogue />} />
              <Route path="/search" element={<Search />} />
              <Route path="/payment/callback" element={<PaymentCallback />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
            </Route>
            <Route element={<RequireAuth><AccountLayout /></RequireAuth>}>
              <Route path="/account" element={<Account />} />
              <Route path="/account/orders" element={<AccountOrders />} />
              <Route path="/account/orders/:id" element={<AccountOrderDetails />} />
              <Route path="/account/addresses" element={<AccountAddresses />} />
              <Route path="/account/wishlist" element={<AccountWishlist />} />
              <Route path="/account/receipts" element={<AccountReceipts />} />
              <Route path="/account/cart" element={<AccountCart />} />
              <Route path="/account/reviews" element={<AccountReviews />} />
              <Route path="/account/notifications" element={<AccountNotifications />} />
              <Route path="/account/offers" element={<AccountOffers />} />
              <Route path="/account/support" element={<AccountSupport />} />
              <Route path="/account/profile" element={<AccountProfile />} />
              <Route path="/account/security" element={<AccountSecurity />} />
              <Route path="/account/settings" element={<AccountSettings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}
