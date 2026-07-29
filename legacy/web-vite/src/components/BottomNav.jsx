import {
  Compass,
  Map,
  MessageCircle,
  Sparkles,
  UserRound,
  LayoutDashboard,
} from "lucide-react";

import styles from "./BottomNav.module.css";

export default function BottomNav({
  currentScreen,
  userType,
  onExplore,
  onTrips,
  onDashboard,
  onSmartMatch,
  onMessages,
  onProfile,
  unreadMessages = 0,
}) {
  const normalizedUserType = String(userType || "")
    .trim()
    .toLowerCase();

  const isAgency = normalizedUserType === "agency";

  const firstItem = isAgency
    ? {
        key: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        onClick: onDashboard,
      }
    : {
        key: "explore",
        label: "Explore",
        icon: Compass,
        onClick: onExplore,
      };

  const items = [
    firstItem,
    {
      key: "trips",
      label: "Trips",
      icon: Map,
      onClick: onTrips,
    },
    {
      key: "smartmatch",
      label: "AI",
      icon: Sparkles,
      onClick: onSmartMatch,
      isAi: true,
    },
    {
      key: "chat",
      label: "Messages",
      icon: MessageCircle,
      onClick: onMessages,
      badge: Number(unreadMessages) || 0,
    },
    {
      key: "profile",
      label: "Profile",
      icon: UserRound,
      onClick: onProfile,
    },
  ];

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.key;
        const hasBadge =
          item.key === "chat" && Number(item.badge) > 0;

        const className = [
          styles.item,
          item.isAi ? styles.aiItem : "",
          isActive ? styles.active : "",
        ]
          .filter(Boolean)
          .join(" ");

        const handleClick = () => {
          if (typeof item.onClick === "function") {
            item.onClick();
          }
        };

        return (
          <button
            key={item.key}
            type="button"
            className={className}
            onClick={handleClick}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={styles.icon}>
              <Icon
                size={item.isAi ? 29 : 27}
                strokeWidth={item.isAi ? 2.3 : 2.1}
                aria-hidden="true"
              />

              {hasBadge && (
                <span className={styles.badge}>
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </span>

            {item.isAi ? (
              <span className={styles.aiLabel}>AI</span>
            ) : (
              <span
                className={styles.indicator}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}