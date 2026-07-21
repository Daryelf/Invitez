import {
  getAdminAccess,
} from "@/app/admin-auth";
import AdminAuthForm from "./auth-form";
import AdminClient from "./admin-client";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Argentum Studio | Invitation Creator",
  description: "Create, deliver, and monitor event invitations.",
};

export default async function AdminPage() {
  const access = await getAdminAccess();

  if (!access.user) {
    return (
      <main className={styles.authPage}>
        <section className={styles.authCard}>
          <div className={styles.authMark}>A</div>
          <p className={styles.eyebrow}>Argentum Studio</p>
          <AdminAuthForm />
          <a className={styles.backLink} href="https://www.invitez.xyz">Return to invitation</a>
        </section>
      </main>
    );
  }

  return (
    <AdminClient />
  );
}
