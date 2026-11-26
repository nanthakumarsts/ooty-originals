import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { PageSkeleton, Spinner } from './components/ui';
import { useApp } from './context/AppContext';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const ProductForm = lazy(() => import('./pages/ProductForm'));
const Categories = lazy(() => import('./pages/Categories'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Returns = lazy(() => import('./pages/Returns'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const Coupons = lazy(() => import('./pages/Coupons'));
const SiteSettings = lazy(() => import('./pages/SiteSettings'));
const Banners = lazy(() => import('./pages/Banners'));
const Pages = lazy(() => import('./pages/Pages'));
const Reviews = lazy(() => import('./pages/Reviews'));
const Messages = lazy(() => import('./pages/Messages'));
const Account = lazy(() => import('./pages/Account'));
const Reports = lazy(() => import('./pages/Reports'));

function Protected() {
  const { admin, ready } = useApp();
  const location = useLocation();
  if (!ready) return <Spinner className="min-h-dvh" />;
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return (
    <Layout>
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

function Guest() {
  const { admin, ready } = useApp();
  const location = useLocation();
  if (!ready) return <Spinner className="min-h-dvh" />;
  if (admin) return <Navigate to={location.state?.from || '/'} replace />;
  return (
    <Suspense fallback={<Spinner className="min-h-dvh" />}>
      <Outlet />
    </Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Guest />}>
        <Route path="login" element={<Login />} />
        <Route path="forgot-password" element={<Navigate to="/login" replace />} />
        <Route path="reset-password" element={<Navigate to="/login" replace />} />
      </Route>
      <Route element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="reports" element={<Reports />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="categories" element={<Categories />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="returns" element={<Returns />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="coupons" element={<Coupons />} />
        <Route path="content/banners" element={<Banners />} />
        <Route path="content/settings" element={<SiteSettings />} />
        <Route path="content/pages" element={<Pages />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="messages" element={<Messages />} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
