import { FiSettings } from "react-icons/fi";
import "./Layout.css";

function Layout({ children }) {
  return (
    <div className="layout">
      <header className="top-header">
        <div className="header-left">
          <h1 className="system-title">관리자 시스템</h1>
        </div>
      </header>
      <div className="layout-body">
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <div className="sidebar-item active">
              <FiSettings className="sidebar-icon" />
              <span>구독자 관리</span>
            </div>
          </nav>
        </aside>
        <main className="main-content">
          <div className="content-header">
            <h2>구독자 관리</h2>
          </div>
          <div className="content">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
