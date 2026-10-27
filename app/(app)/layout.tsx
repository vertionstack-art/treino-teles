import Offline from "@/components/offline";
import Tabbar from "@/components/tabbar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Offline />
      {children}
      <Tabbar />
    </>
  );
}
