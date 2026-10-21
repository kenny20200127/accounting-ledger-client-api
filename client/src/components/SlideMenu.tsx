import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  X,
} from 'lucide-react';
import type { Company, MenuItem, PageKey } from '../types';
import { menuCodeToPageKey, pageKeyToMenuCode } from '../types';
import { resolveMenuIcon } from './iconMap';

interface SlideMenuProps {
  company?: Company;
  menus: MenuItem[];
  activePage: PageKey;
  onNavigate: (key: PageKey) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  user: {
    username: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  onLogout: () => void;
}

// Logical grouping tags for nice categorization
const categoryGroups: { name: string; codes: string[] }[] = [
  { name: 'OVERVIEW', codes: ['DASHBOARD'] },
  {
    name: 'FINANCIAL LEDGER',
    codes: ['CHART_OF_ACCOUNTS', 'JOURNAL_ENTRIES', 'BANKING', 'BANK_RECONCILIATION', 'LEDGER', 'REPORTS'],
  },
  { name: 'SALES & RECEIVABLES', codes: ['INVOICES', 'CUSTOMERS', 'PAYMENTS'] },
  { name: 'PURCHASING & SPEND', codes: ['EXPENSES', 'SUPPLIERS'] },
  { name: 'ORGANIZATION & ASSETS', codes: ['COMPANIES', 'BRANCHES', 'FIXED_ASSETS'] },
  { name: 'ACCOUNTING SETUP', codes: ['FISCAL_YEARS', 'ACCOUNTING_PERIODS'] },
  { name: 'ADMINISTRATION & AUDIT', codes: ['USERS', 'ROLES', 'AUDIT_LOGS'] },
];

export function SlideMenu({
  company, menus,
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  user,
  onLogout,
}: SlideMenuProps) {
  const [filterText, setFilterText] = useState('');

  // Close mobile slide menu on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && mobileOpen) {
        onCloseMobile();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Filtered menus
  const filteredMenus = useMemo(() => {
    if (!filterText.trim()) return menus;
    const term = filterText.toLowerCase();
    return menus.filter(
      (m) =>
        m.menuName.toLowerCase().includes(term) ||
        m.menuCode.toLowerCase().includes(term),
    );
  }, [menus, filterText]);

  // Group menus
  const groupedSections = useMemo(() => {
    const matched = new Set<string>();
    const sections: { name: string; items: MenuItem[] }[] = [];

    for (const group of categoryGroups) {
      const items = filteredMenus.filter((m) => group.codes.includes(m.menuCode));
      if (items.length > 0) {
        sections.push({ name: group.name, items });
        items.forEach((item) => matched.add(item.menuId));
      }
    }

    // Any remaining custom menus from DB
    const remaining = filteredMenus.filter((m) => !matched.has(m.menuId));
    if (remaining.length > 0) {
      sections.push({ name: 'ADDITIONAL MODULES', items: remaining });
    }

    return sections;
  }, [filteredMenus]);

  const activeMenuCode = pageKeyToMenuCode[activePage];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="slide-menu-backdrop"
          onClick={onCloseMobile}
          aria-label="Close menu backdrop"
        />
      )}

      {/* Slide Menu Sidebar Container */}
      <aside
        className={`slide-menu ${mobileOpen ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''
          }`}
        aria-label="Main Navigation Menu"
      >
        {/* Brand & Drawer Header */}
        <div className="slide-brand">
          <div className={`brand-icon ${company?.logoData ? 'has-company-logo' : ''}`}>{company?.logoData ? <img className="company-brand-logo" src={company.logoData} alt={company.companyName + ' logo'} /> : <span />}</div>
          {!collapsed && (
            <div className="brand-text">
              <strong>{company?.companyName ?? 'Northstar'}</strong>
              <small>ACCOUNTING SUITE</small>
            </div>
          )}

          {/* Mobile Close Button */}
          <button
            className="icon-btn mobile-close-btn"
            onClick={onCloseMobile}
            title="Close menu"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>

          {/* Desktop Slide Collapse Toggle */}
          <button
            className="desktop-collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand slide menu' : 'Collapse slide menu'}
            aria-label={collapsed ? 'Expand slide menu' : 'Collapse slide menu'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>



        {/* Search filter in slide menu */}
        {!collapsed && (
          <div className="menu-search-box">
            <Search size={14} className="menu-search-icon" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search modules..."
              className="menu-search-input"
            />
            {filterText && (
              <button
                className="clear-search-btn"
                onClick={() => setFilterText('')}
                aria-label="Clear filter"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Nav List */}
        <div className="slide-nav-scroll">
          <nav className="slide-nav">
            {groupedSections.map((section) => (
              <div key={section.name} className="nav-group">
                {!collapsed && (
                  <div className="nav-group-title">{section.name}</div>
                )}
                {section.items.map((item) => {
                  const targetPage =
                    menuCodeToPageKey[item.menuCode] || 'dashboard';
                  const isSelected =
                    activePage === targetPage ||
                    activeMenuCode === item.menuCode;
                  const Icon = resolveMenuIcon(item.icon, item.menuCode);

                  return (
                    <button
                      key={item.menuId}
                      className={`slide-nav-item ${isSelected ? 'is-selected' : ''
                        }`}
                      onClick={() => {
                        onNavigate(targetPage);
                        onCloseMobile();
                      }}
                      title={collapsed ? item.menuName : undefined}
                    >
                      <span className="slide-nav-icon">
                        <Icon size={17} />
                      </span>
                      {!collapsed && (
                        <>
                          <span className="slide-nav-label">
                            {item.menuName}
                          </span>
                          {item.menuCode === 'DASHBOARD' && (
                            <span className="nav-badge-pill">Live</span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Slide Menu Footer */}
        <div className="slide-footer">
          {!collapsed ? (
            <div className="user-profile-widget">
              <button
                className="user-info-btn"
                onClick={onLogout}
                title="Sign out of ledger"
              >
                <span className="user-avatar-circle">
                  {(user.firstName?.[0] || user.username[0] || 'U').toUpperCase()}
                </span>
                <div className="user-details">
                  <b>
                    {user.firstName
                      ? `${user.firstName} ${user.lastName ?? ''}`
                      : user.username}
                  </b>
                  <small>Administrator</small>
                </div>
                <LogOut size={15} className="logout-icon" />
              </button>
            </div>
          ) : (
            <button
              className="collapsed-logout-btn"
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
