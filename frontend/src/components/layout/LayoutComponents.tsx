import React, { useEffect } from 'react';
import { 
  Menu, X, Bell, User, Loader2, LogOut, 
  AlertCircle, CheckCircle2, Info, XCircle, ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper function to combine classNames safely
export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

// ==========================================
// 1. PAGE CONTAINER
// ==========================================
interface PageContainerProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  bottomNav?: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  sidebar,
  header,
  bottomNav,
  className = '',
}) => {
  return (
    <div className={cn("min-h-screen bg-white dark:bg-[#0d0c18] flex flex-col md:flex-row transition-colors duration-200 text-chosen-text-primary", className)}>
      {/* Sidebar container */}
      {sidebar && (
        <div className="shrink-0 z-30">
          {sidebar}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Header across the top */}
        {header && (
          <div className="sticky top-0 z-20">
            {header}
          </div>
        )}

        {/* Scrollable central content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Bottom Navigation for Mobile */}
        {bottomNav && (
          <div className="block md:hidden sticky bottom-0 z-20">
            {bottomNav}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 2. HEADER
// ==========================================
interface HeaderProps {
  title?: string;
  subtitle?: string;
  profileName?: string;
  profileRole?: string;
  onMenuToggle?: () => void;
  showMenuToggle?: boolean;
  breadcrumbs?: Array<{ label: string; active?: boolean; onClick?: () => void }>;
  notificationsCount?: number;
  onNotificationsClick?: () => void;
  avatarUrl?: string;
  onSignOut?: () => void;
  children?: React.ReactNode;
  logo?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  profileName,
  profileRole,
  onMenuToggle,
  showMenuToggle = false,
  breadcrumbs,
  notificationsCount = 0,
  onNotificationsClick,
  avatarUrl,
  onSignOut,
  children,
  logo,
}) => {
  return (
    <header className="w-full bg-white/80 dark:bg-[#0d0c18]/80 backdrop-blur-md border-b border-[#E5E5E5] dark:border-charcoal-800 px-6 py-4 flex items-center justify-between transition-colors duration-200">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu trigger */}
        {showMenuToggle && onMenuToggle && (
          <button 
            onClick={onMenuToggle} 
            className="md:hidden p-1.5 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md text-chosen-text-secondary"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Logo block */}
        {logo && (
          <div className="h-9 w-9 bg-[#141414] dark:bg-white rounded-chosen-md flex items-center justify-center text-white dark:text-[#141414] shadow-chosen-sm shrink-0">
            {logo}
          </div>
        )}

        {/* Breadcrumbs or standard Title */}
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1.5 text-xs md:text-sm font-semibold select-none min-w-0">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-chosen-text-muted shrink-0" />}
                {crumb.onClick && !crumb.active ? (
                  <button 
                    onClick={crumb.onClick}
                    className="hover:text-gold-500 text-chosen-text-secondary truncate transition-colors"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className={cn(crumb.active ? "text-chosen-text-primary font-bold" : "text-chosen-text-muted", "truncate")}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        ) : (
          <div className="text-left min-w-0">
            {title && <h2 className="text-lg md:text-xl font-display font-bold text-[#0D0C18] dark:text-white truncate">{title}</h2>}
            {subtitle && <p className="text-2xs md:text-xs text-chosen-text-muted truncate mt-0.5">{subtitle}</p>}
          </div>
        )}
      </div>

      {/* Center children if provided */}
      {children && <div className="hidden lg:flex flex-1 justify-center px-4 max-w-xl">{children}</div>}

      {/* Right side profile / actions */}
      <div className="flex items-center gap-4 shrink-0">
        {onNotificationsClick && (
          <button 
            onClick={onNotificationsClick}
            className="p-2 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md relative text-chosen-text-secondary transition-all active:scale-95"
          >
            <Bell className="h-5 w-5" />
            {notificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
            )}
          </button>
        )}

        {(profileName || profileRole) && (
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-sm font-semibold text-chosen-text-primary leading-tight">
              {profileName}
            </span>
            {profileRole && (
              <span className="text-[10px] bg-gold-500/10 text-gold-500 px-2 py-0.5 rounded-full font-bold uppercase mt-0.5 select-none">
                {profileRole}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt="avatar" 
              className="h-9 w-9 rounded-full object-cover border border-[#E5E5E5] dark:border-charcoal-800"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-[#F5F5F5] dark:bg-charcoal-850 flex items-center justify-center text-chosen-text-secondary border border-[#E5E5E5] dark:border-charcoal-800">
              <User className="h-5 w-5" />
            </div>
          )}
          
          {onSignOut && (
            <button 
              onClick={onSignOut}
              className="sm:hidden p-2 hover:bg-red-500/10 hover:text-red-500 rounded-chosen-md text-chosen-text-secondary transition-all"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

// ==========================================
// 3. SIDEBAR
// ==========================================
interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active: boolean;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  items: SidebarItem[];
  profile?: { name: string; email: string; role: string };
  onSignOut?: () => void;
  logo?: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  title = "Chosen Life",
  subtitle = "Portal",
  items,
  profile,
  onSignOut,
  logo,
}) => {
  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div 
        onClick={onClose}
        className={cn(
          "fixed inset-0 bg-[#0d0c18]/60 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Main Sidebar Wrapper */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-[#0D0C18] text-slate-300 flex flex-col border-r border-[#E5E5E5]/10 z-50 transition-transform duration-300 ease-in-out md:translate-x-0 md:sticky md:top-0 md:h-screen md:shrink-0",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Sidebar Header */}
        <div className="p-6 flex items-center justify-between border-b border-charcoal-800 shrink-0">
          <div className="flex items-center gap-3 text-left">
            {logo ? (
              <div className="h-9 w-9 bg-white rounded-chosen-md flex items-center justify-center shadow-chosen-sm text-[#A27B41]">
                {logo}
              </div>
            ) : (
              <div className="h-9 w-9 bg-white rounded-chosen-md flex items-center justify-center shadow-chosen-sm text-[#A27B41] font-bold font-display text-lg">
                C
              </div>
            )}
            <div>
              <span className="font-display font-bold text-base text-white block leading-none">{title}</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#A27B41] block mt-1">{subtitle}</span>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="md:hidden p-1 text-slate-400 hover:text-white rounded hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-chosen-md text-sm font-semibold transition-all select-none text-left",
                item.active 
                  ? "bg-[#A27B41]/15 text-[#A27B41] border-l-2 border-[#A27B41]" 
                  : "hover:bg-white/5 hover:text-white text-slate-400"
              )}
            >
              <span className={cn(item.active ? "text-[#A27B41]" : "text-slate-400")}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Sidebar Footer / User Profile details */}
        <div className="p-4 border-t border-charcoal-800 shrink-0">
          {profile && (
            <div className="flex items-center gap-3 px-4 py-2 mb-3">
              <div className="h-8 w-8 bg-gold-500/10 rounded-full flex items-center justify-center font-bold text-xs text-gold-500 uppercase select-none shrink-0">
                {profile.name?.[0] || 'U'}
              </div>
              <div className="min-w-0 text-left">
                <span className="font-semibold text-xs text-white block truncate">{profile.name}</span>
                <span className="text-[9px] text-slate-450 block truncate">{profile.email}</span>
              </div>
            </div>
          )}
          
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-950/15 rounded-chosen-md transition-all select-none"
            >
              <LogOut className="h-4.5 w-4.5 shrink-0" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

// ==========================================
// 4. CONTENT WRAPPER
// ==========================================
interface ContentWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export const ContentWrapper: React.FC<ContentWrapperProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={cn("max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 md:space-y-8", className)}>
      {children}
    </div>
  );
};

// ==========================================
// 5. SECTION WRAPPER
// ==========================================
interface SectionWrapperProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const SectionWrapper: React.FC<SectionWrapperProps> = ({
  children,
  title,
  subtitle,
  actions,
  className = '',
}) => {
  return (
    <section className={cn("space-y-4 text-left", className)}>
      {(title || subtitle || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E5E5] dark:border-charcoal-800 pb-3">
          <div>
            {title && <h3 className="font-display font-bold text-base md:text-lg text-chosen-text-primary">{title}</h3>}
            {subtitle && <p className="text-2xs md:text-xs text-chosen-text-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 self-start sm:self-auto">{actions}</div>}
        </div>
      )}
      <div className="w-full">{children}</div>
    </section>
  );
};

// ==========================================
// 6. RESPONSIVE GRID
// ==========================================
interface ResponsiveGridProps {
  children: React.ReactNode;
  colsMobile?: 1 | 2;
  colsTablet?: 2 | 3;
  colsDesktop?: 3 | 4 | 5;
  className?: string;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  colsMobile = 1,
  colsTablet = 2,
  colsDesktop = 3,
  className = '',
}) => {
  const gridClasses = {
    mobile: {
      1: "grid-cols-1",
      2: "grid-cols-2",
    },
    tablet: {
      2: "md:grid-cols-2",
      3: "md:grid-cols-3",
    },
    desktop: {
      3: "lg:grid-cols-3",
      4: "lg:grid-cols-4",
      5: "lg:grid-cols-5",
    }
  };

  return (
    <div className={cn(
      "grid gap-4 md:gap-6",
      gridClasses.mobile[colsMobile],
      gridClasses.tablet[colsTablet],
      gridClasses.desktop[colsDesktop],
      className
    )}>
      {children}
    </div>
  );
};

// ==========================================
// 7. CARD GRID
// ==========================================
interface CardGridProps {
  children: React.ReactNode;
  className?: string;
}

export const CardGrid: React.FC<CardGridProps> = ({ children, className = '' }) => {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6", className)}>
      {children}
    </div>
  );
};

// ==========================================
// 8. DRAWER (Slide-out panel)
// ==========================================
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className={cn(
          "fixed inset-0 bg-[#0d0c18]/60 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Drawer Body */}
      <div className={cn(
        "fixed inset-y-0 right-0 max-w-md w-full bg-white dark:bg-[#121122] border-l border-[#E5E5E5] dark:border-charcoal-800 shadow-chosen-modal z-50 flex flex-col transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E5E5] dark:border-charcoal-800 flex justify-between items-center text-left shrink-0">
          <h3 className="font-display font-bold text-lg text-chosen-text-primary">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md text-chosen-text-muted hover:text-chosen-text-primary transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 text-left panel-scroll">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-6 border-t border-[#E5E5E5] dark:border-charcoal-800 bg-[#FAFBFC] dark:bg-charcoal-850 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </>
  );
};

// ==========================================
// 9. MODAL
// ==========================================
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-[#0d0c18]/60 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Modal Dialog Container */}
      <div className={cn(
        "w-full bg-white dark:bg-[#121122] border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg relative shadow-chosen-modal flex flex-col max-h-[90vh] transition-all transform scale-100 z-10",
        sizeClasses[size]
      )}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E5E5] dark:border-charcoal-800 flex justify-between items-center text-left shrink-0">
          <h3 className="font-display font-bold text-lg text-chosen-text-primary">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md text-chosen-text-muted hover:text-chosen-text-primary transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 text-left panel-scroll">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[#E5E5E5] dark:border-charcoal-800 bg-[#FAFBFC] dark:bg-charcoal-850/40 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 10. TOAST (Notification Alert)
// ==========================================
interface ToastProps {
  message: string;
  type?: 'success' | 'warning' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    let timer: any;
    if (duration > 0) {
      timer = setTimeout(() => {
        onClose();
      }, duration);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [duration, onClose]);

  const styleClasses = {
    success: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900/30 text-emerald-850 dark:text-emerald-400",
    warning: "bg-amber-50 dark:bg-amber-950/20 border-amber-250 dark:border-amber-900/30 text-amber-850 dark:text-amber-455",
    error: "bg-rose-50 dark:bg-rose-950/20 border-rose-250 dark:border-rose-900/30 text-rose-850 dark:text-rose-400",
    info: "bg-blue-50 dark:bg-blue-950/20 border-blue-250 dark:border-blue-900/30 text-blue-850 dark:text-blue-400",
  };

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 shrink-0" />,
    warning: <AlertCircle className="h-5 w-5 shrink-0" />,
    error: <XCircle className="h-5 w-5 shrink-0" />,
    info: <Info className="h-5 w-5 shrink-0" />,
  };

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 border.5 rounded-chosen-md shadow-chosen-md max-w-sm animate-slide-up",
      styleClasses[type]
    )}>
      {icons[type]}
      <span className="text-xs font-semibold text-left">{message}</span>
      <button 
        onClick={onClose}
        className="p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-all ml-auto shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// ==========================================
// 11. LOADING STATE
// ==========================================
interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading information...",
  className = '',
}) => {
  return (
    <div className={cn("min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center", className)}>
      <Loader2 className="h-10 w-10 text-gold-500 animate-spin" />
      <span className="text-xs text-chosen-text-muted font-bold uppercase tracking-wider">{message}</span>
    </div>
  );
};

// ==========================================
// 12. EMPTY STATE
// ==========================================
interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionButton?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionButton,
  className = '',
}) => {
  return (
    <div className={cn(
      "text-center py-12 px-6 border border-dashed border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg bg-[#FAFBFC] dark:bg-charcoal-850/30 text-chosen-text-muted flex flex-col items-center justify-center gap-3.5",
      className
    )}>
      {icon ? (
        <div className="text-chosen-text-muted">{icon}</div>
      ) : (
        <div className="h-12 w-12 rounded-chosen-md bg-[#F5F5F5] dark:bg-charcoal-800 flex items-center justify-center text-chosen-text-muted">
          <AlertCircle className="h-6 w-6" />
        </div>
      )}
      <div className="space-y-1">
        <p className="font-bold text-sm text-chosen-text-primary">{title}</p>
        <p className="text-xs text-chosen-text-secondary max-w-sm mx-auto leading-relaxed">{description}</p>
      </div>
      {actionButton && <div className="mt-1">{actionButton}</div>}
    </div>
  );
};

// ==========================================
// 13. ERROR STATE
// ==========================================
interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
  actionButton?: React.ReactNode;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  description,
  onRetry,
  actionButton,
  className = '',
}) => {
  return (
    <div className={cn(
      "text-center py-12 px-6 border border-red-200 dark:border-red-950/20 bg-rose-50/50 dark:bg-rose-950/5 rounded-chosen-lg text-chosen-text-muted flex flex-col items-center justify-center gap-4",
      className
    )}>
      <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center text-red-500">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="font-bold text-sm text-red-650 dark:text-red-400">{title}</p>
        <p className="text-xs text-chosen-text-secondary max-w-sm mx-auto leading-relaxed">{description}</p>
      </div>
      {(onRetry || actionButton) && (
        <div className="flex gap-3">
          {onRetry && (
            <button 
              onClick={onRetry}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-chosen-md text-xs transition-all active:scale-95 shadow-sm"
            >
              Retry
            </button>
          )}
          {actionButton}
        </div>
      )}
    </div>
  );
};
