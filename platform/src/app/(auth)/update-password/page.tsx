import type { Metadata } from "next";

import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = { title: "Choose a new password · WRI" };

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
