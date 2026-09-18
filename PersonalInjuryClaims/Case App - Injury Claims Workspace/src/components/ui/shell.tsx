import type { LucideIcon } from "lucide-react";
import type { FC, PropsWithChildren, ReactNode } from "react";
import { useContext } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthContext, useAuth } from "./shell-auth-provider";
import { ShellLayout } from "./shell-layout";
import { LocaleProvider } from "./shell-locale-provider";
import { ShellLogin } from "./shell-login";
import type { TranslationKey } from "./shell-translation-key";
import { ShellUserProvider } from "./shell-user-provider";

export interface CompanyLogo {
  url: string;
  darkUrl?: string;
  alt: string;
  isCustom?: boolean;
}

export interface ShellSubNavItem {
  path: string;
  label: TranslationKey;
}

export interface ShellNavItem {
  path: string;
  label: TranslationKey;
  icon: LucideIcon;
  subItems?: ShellSubNavItem[];
  /** Optional trailing content (e.g. a count badge) shown at the right of the item when expanded. */
  badge?: ReactNode;
}

export interface ApolloShellProps extends PropsWithChildren {
  companyName: string;
  productName: string;
  variant?: "minimal";
  companyLogo?: CompanyLogo;
  navItems: ShellNavItem[];
  loginDescription?: string;
  /**
   * Optional replacement for the sidebar's company/product block — e.g. an app
   * switcher. Ignored when the sidebar is collapsed and in the minimal variant.
   */
  appSwitcher?: ReactNode;
  /**
   * Optional content above the user profile in the sidebar footer — e.g. demo
   * feature flags. Rendered with `isCollapsed` so it can hide itself on the rail.
   */
  sidebarFooter?: ReactNode;
}

const ApolloShellContent: FC<ApolloShellProps> = ({
  children,
  companyName,
  productName,
  companyLogo,
  variant,
  navItems,
  loginDescription,
  appSwitcher,
  sidebarFooter,
}) => {
  const authContext = useContext(AuthContext);
  const { accessToken } = useAuth();

  if (authContext && !accessToken) {
    return <ShellLogin title={productName} description={loginDescription} />;
  }

  return (
    <ShellUserProvider>
      <ShellLayout
        companyName={companyName}
        productName={productName}
        companyLogo={companyLogo}
        variant={variant}
        navItems={navItems}
        appSwitcher={appSwitcher}
        sidebarFooter={sidebarFooter}
      >
        {children}
      </ShellLayout>
    </ShellUserProvider>
  );
};

export const ApolloShell: FC<ApolloShellProps> = ({
  children,
  companyName,
  productName,
  companyLogo,
  variant,
  navItems,
  loginDescription,
  appSwitcher,
  sidebarFooter,
}) => {
  return (
    <LocaleProvider
      loadingElement={
        <div className="flex h-screen gap-4 p-4 bg-background dark:bg-sidebar">
          <Skeleton className="h-full w-[280px]" />
          <Skeleton className="h-full flex-1 rounded-lg" />
        </div>
      }
    >
      <ApolloShellContent
        companyName={companyName}
        productName={productName}
        companyLogo={companyLogo}
        variant={variant}
        navItems={navItems}
        loginDescription={loginDescription}
        appSwitcher={appSwitcher}
        sidebarFooter={sidebarFooter}
      >
        {children}
      </ApolloShellContent>
    </LocaleProvider>
  );
};
