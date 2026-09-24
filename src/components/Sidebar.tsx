import React from 'react';
import {
  LayoutDashboard,
  Users,
  Layers,
  Compass,
  Clock,
  Calendar,
  BarChart3,
  Settings,
  Sun,
  Leaf,
  X,
  Shield,
  Briefcase,
  Hammer,
  Sparkles,
  FileText,
  Gauge,
  Receipt,
  ReceiptIndianRupee,
  ShieldCheck,
  Building2,
  Truck,
  Navigation,
} from 'lucide-react';
import { User, UserRole } from '../../shared/types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCreateLead?: () => void;
  onOpenSettings?: () => void;
  currentUser: User;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isAction?: boolean;
  badge?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  currentUser,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const role: UserRole = currentUser?.role || 'LEAD';

  // Rule: For Lead Team, sidebar is strictly: Dashboard, Lead, Project (ECP Projects).
  // For other teams (Owner, Sales Manager, Installation Manager), sidebar is tailored to their full responsibilities.
  const getNavSections = (): NavSection[] => {
    if (role === 'DISPATCH') {
      return [
        {
          title: 'Dispatch Command',
          items: [
            {
              id: 'dispatch',
              label: 'Dispatch Queue',
              icon: Truck,
            },
            {
              id: 'b2c_dispatch',
              label: 'B2C Clearance Gate',
              icon: ShieldCheck,
            },
            {
              id: 'dashboard',
              label: 'Dashboard',
              icon: LayoutDashboard,
            },
            {
              id: 'ecp_projects',
              label: 'Projects',
              icon: Layers,
            },
          ],
        },
      ];
    }

    if (role === 'ACCOUNTS') {
      return [
        {
          title: 'Accounts Desk',
          items: [
            {
              id: 'accounts',
              label: 'Overview & Ledger',
              icon: Receipt,
            },
            {
              id: 'b2c_dispatch',
              label: 'B2C Dispatch Gate',
              icon: ShieldCheck,
            },
            {
              id: 'b2b_credit',
              label: 'B2B Credit Terms',
              icon: Building2,
            },
            {
              id: 'receipts',
              label: 'Receipts Book',
              icon: ReceiptIndianRupee,
            },
            {
              id: 'followups',
              label: 'Receipt Follow-ups',
              icon: Clock,
            },
          ],
        },
      ];
    }

    if (role === 'REGISTRATION') {
      return [
        {
          items: [
            {
              id: 'registration',
              label: 'Registration Queue',
              icon: FileText,
            },
            {
              id: 'dashboard',
              label: 'Dashboard',
              icon: LayoutDashboard,
            },
            {
              id: 'ecp_projects',
              label: 'Projects',
              icon: Layers,
            },
          ],
        },
      ];
    }

    if (role === 'LEAD') {
      return [
        {
          items: [
            {
              id: 'dashboard',
              label: 'Dashboard',
              icon: LayoutDashboard,
            },
            {
              id: 'leads',
              label: 'Lead',
              icon: Users,
            },
            {
              id: 'ecp_projects',
              label: 'Project',
              icon: Layers,
            },
          ],
        },
      ];
    }

    if (role === 'OWNER') {
      return [
        {
          title: 'Executive',
          items: [
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'leads', label: 'Lead', icon: Users },
            { id: 'ecp_projects', label: 'Projects', icon: Layers },
            { id: 'site_visits', label: 'Site Feasibility', icon: Compass },
          ],
        },
        {
          title: 'Operations & Insights',
          items: [
            { id: 'registration', label: 'Registration Queue', icon: FileText },
            { id: 'accounts', label: 'Accounts & Receipts', icon: Receipt },
            { id: 'dispatch', label: 'Dispatch & Logistics', icon: Truck },
            { id: 'followups', label: 'Follow-ups', icon: Clock },
            { id: 'reports', label: 'Reports & P&L', icon: BarChart3 },
            { id: 'calendar', label: 'Calendar', icon: Calendar },
          ],
        },
        {
          title: 'Administration',
          items: [
            {
              id: 'settings',
              label: 'System Settings',
              icon: Settings,
              isAction: true,
            },
          ],
        },
      ];
    }

    if (role === 'MANAGER') {
      return [
        {
          title: 'Sales Command',
          items: [
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'leads', label: 'Lead', icon: Users },
            { id: 'accounts', label: 'Accounts Desk', icon: Receipt },
            { id: 'dispatch', label: 'Dispatch & Logistics', icon: Truck },
            { id: 'registration', label: 'Registration Queue', icon: FileText },
            { id: 'followups', label: 'Follow-ups', icon: Clock },
            { id: 'ecp_projects', label: 'Projects', icon: Layers },
          ],
        },
        {
          title: 'Field & Reporting',
          items: [
            { id: 'site_visits', label: 'Site Feasibility', icon: Compass },
            { id: 'reports', label: 'Reports & SLAs', icon: BarChart3 },
            { id: 'calendar', label: 'Calendar', icon: Calendar },
          ],
        },
      ];
    }

    if (role === 'INSTALLATION_MANAGER') {
      return [
        {
          title: 'Operations Command',
          items: [
            { id: 'installation_command', label: 'Control Centre', icon: LayoutDashboard },
            { id: 'ecp_projects', label: 'All Projects', icon: Layers },
          ],
        },
      ];
    }

    // INSTALLATION_MEMBER (Field Technician)
    return [
      {
        title: 'Field Execution',
        items: [
          { id: 'installation_command', label: 'Control Centre', icon: LayoutDashboard },
          { id: 'site_visits', label: 'Site Surveys', icon: Compass },
          { id: 'ecp_projects', label: 'My Installations', icon: Hammer },
        ],
      },
    ];
  };

  const navSections = getNavSections();

  const handleItemClick = (item: NavItem) => {
    if (item.isAction && item.id === 'settings') {
      if (role === 'OWNER' && onOpenSettings) onOpenSettings();
    } else {
      setActiveTab(item.id);
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const getRoleBadge = () => {
    switch (role) {
      case 'OWNER':
        return {
          label: 'Executive Owner',
          icon: Shield,
          colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
        };
      case 'MANAGER':
        return {
          label: 'Sales Manager',
          icon: Briefcase,
          colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
        };
      case 'INSTALLATION_MANAGER':
        return {
          label: 'Installation Manager',
          icon: Hammer,
          colorClass: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
        };
      case 'INSTALLATION_MEMBER':
        return {
          label: 'Field Technician',
          icon: Hammer,
          colorClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
        };
      case 'REGISTRATION':
        return {
          label: 'Registration Team',
          icon: FileText,
          colorClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
        };
      case 'ACCOUNTS':
        return {
          label: 'Accounts Team',
          icon: Receipt,
          colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
        };
      case 'LEAD':
      default:
        return {
          label: 'Lead Team',
          icon: Sparkles,
          colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
        };
    }
  };

  const roleBadge = getRoleBadge();
  const RoleIcon = roleBadge.icon;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0f172a] text-slate-300 flex flex-col justify-between border-r border-slate-800/80 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Logo & App Title */}
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Sun className="w-5 h-5 fill-amber-400" />
              </div>
              <div>
                <span className="font-bold text-white tracking-wide text-sm flex items-center gap-1.5">
                  Solar ERP
                </span>
                <p className="text-[10px] text-slate-400 leading-tight">Brighter Homes. Greener Tomorrow.</p>
              </div>
            </div>

            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg lg:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Active Role Indicator */}
          <div className="px-4 pt-3 pb-1">
            <div
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${roleBadge.colorClass}`}
            >
              <RoleIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{roleBadge.label}</span>
              {role === 'LEAD' && (
                <span className="ml-auto text-[9px] uppercase font-bold opacity-75">3-Menu</span>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-4">
            {navSections.map((section, sIdx) => (
              <div key={sIdx} className="space-y-1">
                {section.title && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {section.title}
                  </div>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = !item.isAction && activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <Leaf className="w-3.5 h-3.5 text-emerald-400" />
              <span>Solar ERP v1.0.0</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">IST</span>
          </div>
        </div>
      </aside>
    </>
  );
};
