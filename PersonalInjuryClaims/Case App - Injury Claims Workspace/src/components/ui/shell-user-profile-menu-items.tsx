import { Check, Globe, LogOut, Monitor, Moon, Sun, UserCog } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import type { SupportedLocale } from "@/lib/i18n";
import { ROLE_PROFILES, type Role } from "@/lib/role/RoleProvider";
import { useRole } from "@/lib/role/useRole";
import { cn } from "@/lib/utils";
import { useAuth } from "./shell-auth-provider";
import { LANGUAGE_CHANGED_EVENT, LOCALE_OPTIONS } from "./shell-constants";
import type { LanguageChangedEvent } from "./shell-constants";
import { Text } from "./shell-text";
import { useTheme } from "./shell-theme-provider";

export const UserProfileMenuItems = () => {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  const { setTheme } = useTheme();
  const { role, setRole } = useRole();
  const language = i18n.language;

  function setLanguage(code: SupportedLocale) {
    document.dispatchEvent(
      new CustomEvent<LanguageChangedEvent>(LANGUAGE_CHANGED_EVENT, {
        detail: { selectedLanguageId: code },
      }),
    );
  }

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <UserCog className="w-4 h-4" />
          <span>Switch role</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {(Object.keys(ROLE_PROFILES) as Role[]).map((key) => {
            const p = ROLE_PROFILES[key];
            return (
              <DropdownMenuItem
                key={key}
                onClick={() => setRole(key)}
                className={cn(role === key ? "bg-accent" : "")}
              >
                <div className="flex flex-col">
                  <span>{p.name}</span>
                  <span className="text-xs opacity-60">{p.title}</span>
                </div>
                {role === key && <Check className="ml-auto w-4 h-4" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Sun className="w-4 h-4 dark:hidden" />
          <Moon className="w-4 h-4 hidden dark:block" />
          <span>{t("toggle_theme")}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun className="w-4 h-4" />
            <span>{t("light")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon className="w-4 h-4" />
            <span>{t("dark")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Monitor className="w-4 h-4" />
            <span>{t("system")}</span>
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Globe className="w-4 h-4" />
          <span>{t("language")}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {LOCALE_OPTIONS.map((locale) => (
            <DropdownMenuItem
              key={locale.code}
              onClick={() => setLanguage(locale.code)}
              className={cn(language === locale.code ? "bg-accent" : "")}
            >
              <Text value={locale.translationKey} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={logout}>
        <LogOut className="w-4 h-4" />
        <span>{t("sign_out")}</span>
      </DropdownMenuItem>
    </>
  );
};
