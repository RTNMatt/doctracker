import { Outlet } from 'react-router-dom';
import './Main.css';

export default function Main() {
  return (
    <main className="content-section">
      <Outlet />
    </main>
  );
}