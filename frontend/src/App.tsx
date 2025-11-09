
import './index.css';
import { Outlet } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import { PathTreeProvider } from "./state/PathTree";


export default function App() {
  return (
    <PathTreeProvider>
      <div className="layout">
        <Sidebar />
        <main className="layout-main">
          <Outlet />
        </main>
      </div>
    </PathTreeProvider>
  );
}