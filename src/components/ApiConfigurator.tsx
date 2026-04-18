"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { configureApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function ApiConfigurator() {
  const { getToken, refresh } = useAuth();
  const router = useRouter();

  useEffect(() => {
    configureApi(getToken, refresh, () => {
      router.push("/login");
    });
  }, [getToken, refresh, router]);

  return null;
}
