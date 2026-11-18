import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import CircleTransition from './components/CircleTransition';
import MobileBar from './components/layout/MobileBar';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import { PageSkeleton } from './components/Skeletons';

// Everything except the home page is loaded on demand to keep the first visit fast.
// Each page registers its loader so the rest can be fetched quietly once the browser is idle —
// by the time a link is clicked the page is already there and the transition plays smoothly.
const loaders = [];
const page = (load) => {
  loaders.push(load);
  return lazy(load);
};

const Shop = page(() => import('./pages/Shop'));
const ProductDetail = page(() => import('./pages/ProductDetail'));
const Cart = page(() => import('./pages/Cart'));
const Checkout = page(() => import('./pages/Checkout'));
const OrderResult = page(() => import('./pages/OrderResult'));
const Wishlist = page(() => import('./pages/Wishlist'));
const Compare = page(() => import('./pages/Compare'));
const About = page(() => import('./pages/About'));
const Contact = page(() => import('./pages/Contact'));
const ContentPage = page(() => import('./pages/ContentPage'));
const NotFound = page(() => import('./pages/NotFound'));
const Login = page(() => import('./pages/auth/Login'));
const Register = page(() => import('./pages/auth/Register'));
const ForgotPassword = page(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = page(() => import('./pages/auth/ResetPassword'));
const AccountLayout = page(() => import('./pages/account/AccountLayout'));
const Profile = page(() => import('./pages/account/Profile'));
const Addresses = page(() => import('./pages/account/Addresses'));
const ChangePassword = page(() => import('./pages/account/ChangePassword'));
const Orders = page(() => import('./pages/account/Orders'));
const OrderDetail = page(() => import('./pages/account/OrderDetail'));

function usePreloadPages() {
  useEffect(() => {
    const preload = () => loaders.forEach((load) => load().catch(() => {}));
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(preload, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(preload, 2500);
    return () => clearTimeout(timer);
  }, []);
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // wait for lazy content before jumping to an anchor
      const timer = setTimeout(() => document.querySelector(hash)?.scrollIntoView(), 250);
      return () => clearTimeout(timer);
    }
    window.scrollTo(0, 0);
    return undefined;
  }, [pathname, hash]);
  return null;
}

function Layout() {
  return (
    <div className="flex min-h-dvh flex-col pb-16 lg:pb-0">
      <Header />
      <main id="main" className="flex-1">
        <Suspense fallback={<div data-route-loading><PageSkeleton /></div>}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <MobileBar />
    </div>
  );
}

/** Pages that need a signed-in customer. Sends visitors to sign in, then back again. */
function RequireAuth() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Sign-in pages are pointless once signed in. */
function GuestOnly() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <PageSkeleton />;
  if (user) return <Navigate to={location.state?.from || '/account'} replace />;
  return <Outlet />;
}

export default function App() {
  usePreloadPages();
  return (
    <>
      <ScrollToTop />
      <CircleTransition />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="product/:slug" element={<ProductDetail />} />
          <Route path="cart" element={<Cart />} />
          <Route path="compare" element={<Compare />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="privacy-policy" element={<ContentPage slug="privacy-policy" />} />
          <Route path="terms-and-conditions" element={<ContentPage slug="terms-and-conditions" />} />
          <Route path="refund-policy" element={<ContentPage slug="refund-policy" />} />
          <Route path="refund_returns-2" element={<ContentPage slug="refund-policy" />} />
          <Route path="refund-returns" element={<ContentPage slug="refund-policy" />} />
          <Route path="return-policy" element={<ContentPage slug="refund-policy" />} />
          <Route path="returns-policy" element={<ContentPage slug="refund-policy" />} />

          <Route element={<GuestOnly />}>
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
          </Route>

          <Route path="reset-password" element={<ResetPassword />} />

          <Route element={<RequireAuth />}>
            <Route path="checkout" element={<Checkout />} />
            <Route path="order/:orderNumber" element={<OrderResult />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="account" element={<AccountLayout />}>
              <Route index element={<Profile />} />
              <Route path="addresses" element={<Addresses />} />
              <Route path="password" element={<ChangePassword />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:orderNumber" element={<OrderDetail />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
