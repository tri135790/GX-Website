import { createRoot } from 'react-dom/client';
import AdminApp from '../components/gx/admin-app';
import '../app/globals.css';
import { readAuthLink } from '../lib/gx/auth-link';
import { PasswordPage } from '../components/gx/password-page';

const link = readAuthLink(window.location.href);
createRoot(document.getElementById('root')!).render(
  link.password ? <PasswordPage invalidLink={link.invalid} /> : <AdminApp />,
);
