import type { ReactNode } from "react";

import OrderEmailTrigger from "@/components/orders/OrderEmailTrigger";

type LayoutProps = {
  children: ReactNode;
};

export default function OrderConfirmationLayout({ children }: LayoutProps) {
  return (
    <>
      <OrderEmailTrigger />
      {children}
    </>
  );
}
