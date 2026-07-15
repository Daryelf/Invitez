import {
  getAdminAccess,
  getAdminOwnerEmail,
  isAdminPasswordConfigured,
} from "@/app/admin-auth";
import AdminAuthForm from "./auth-form";
import AdminClient from "./admin-client";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const access = await getAdminAccess();

  if (!access.user) {
    const configured = await isAdminPasswordConfigured();
    return (
      <main className={styles.authPage}>
        <section className={styles.authCard}>
          <div className={styles.authMark}>E</div>
          <p className={styles.eyebrow}>Erika&apos;s Sweet 16</p>
          <AdminAuthForm configured={configured} ownerEmail={getAdminOwnerEmail()} />
          <a className={styles.backLink} href="https://www.invitez.xyz">Return to invitation</a>
        </section>
      </main>
    );
  }

  return (
    <AdminClient
      adminName={access.user.displayName}
      adminEmail={access.user.email}
      signOutPath="/api/admin/auth/logout"
    />
  );
}
