import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ShellAuthBridge } from "@/components/ui/shell-auth-bridge";
import { ThemeProvider } from "@/components/ui/shell-theme-provider";
import { RoleProvider } from "@/lib/role/RoleProvider";
import { UiPathProvider } from "@/services/uipath/UiPathProvider";
import "./index.css";
import { router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    // Case state changes while a demo is running; a refetch on focus is the
    // cheapest way to keep a projected screen honest after an alt-tab.
    queries: { refetchOnWindowFocus: true, retry: 1 },
  },
});

// Providers sit ABOVE the router, not on its root route.
//
// UiPathProvider completes the OAuth callback, and it has to be able to do that
// before any routing decision runs. A route that redirected first would strip
// `?code=&state=` off the URL and the sign-in would loop silently.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider storageKey="injury-claims-app-theme">
        <UiPathProvider>
          <ShellAuthBridge>
            <RoleProvider>
              <RouterProvider router={router} />
            </RoleProvider>
          </ShellAuthBridge>
        </UiPathProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
