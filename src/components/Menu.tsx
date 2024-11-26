import Image from "next/image";
import Link from "next/link";
import MenuItem from "./MenuItem";

const menuItems = [
  {
    title: "MENU",
    items: [
      {
        icon: "/home.png",
        label: "Home",
        action: "/",
        visible: ["admin", "tutor", "student", "parent"],
      },
      {
        icon: "/calendar.png",
        label: "Calendar",
        action: "/",
        visible: ["admin", "tutor", "student", "parent"],
      },
      {
        icon: "/profile.png",
        label: "Profile",
        action: "/profile",
        visible: ["admin", "tutor", "student", "parent"],
      },
      {
        icon: "/message.png",
        label: "Messages",
        action: "/list/students",
        visible: ["admin", "tutor"],
      },
      {
        icon: "/setting.png",
        label: "Settings",
        action: "/list/settings",
        visible: ["admin", "tutor"],
      },
    ],
  },
];

const otherItems = [
  {
    title: "OTHER",
    items: [
      {
        icon: "/profile.png",
        label: "Help/FAQ",
        action: "/help",
        visible: ["admin", "tutor", "student", "parent"],
      },
      {
        icon: "/phone.png",
        label: "Contact Us",
        action: "/contact",
        visible: ["admin", "tutor", "student", "parent"],
      },
      {
        icon: "/logout.png",
        label: "Logout",
        action: "/auth/logout",
        visible: ["admin", "tutor", "student", "parent"],
      },
    ],
  },
];

const Menu = ({ type }: { type: string }) => {
  return (
    <div>
      {/* Logo Section */}
      <div className="flex justify-center mt-4 mb-10">
        <Image src="/logo.png" alt="Logo" width={120} height={40} />
      </div>

      <div className="my-2 h-px bg-gray-300" />

      {/* Menu Section */}
      <div className="mt-5 text-sm">
        {menuItems.map((i) => (
          <div className="flex flex-col gap-2" key={i.title}>
            <span className="hidden lg:block text-gray-400 font-light my-4">
              {i.title}
            </span>
            {i.items.map((item) => (
              <MenuItem item={item} />
            ))}
          </div>
        ))}
        <div className="my-2 h-px bg-gray-300" />

        {otherItems.map((i) => (
          <div className="flex my-5 flex-col gap-2" key={i.title}>
            <span className="hidden lg:block text-gray-400 font-light my-4">
              {i.title}
            </span>
            {i.items.map((item) => (
              <MenuItem item={item} />
            ))}
          </div>
        ))}
      </div>

      <div className="my-4 h-px bg-gray-300" />

      {/* Profile Section */}
      <div className="flex items-center gap-4 justify-start w-full mt-5">
        <Image
          src="/avatar.png"
          alt="Avatar"
          width={40}
          height={40}
          className="rounded-full"
        />
        <div className="flex flex-col items-start">
          <span className="text-xs leading-3 font-medium">
            Zach Berkenkotter
          </span>
          <span className="text-[10px] text-gray-500">Student</span>
          <span className="text-[10px] text-gray-500">...</span>
        </div>
      </div>
    </div>
  );
};

export default Menu;
