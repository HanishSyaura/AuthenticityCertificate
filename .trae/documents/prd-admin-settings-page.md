## 1. Product Overview
Admin Settings lets you manage your own admin profile and system-wide configuration from within the existing admin console navigation.
It provides a standard, form-based experience aligned with the current AdminShell layout and route `/admin/settings`.

## 2. Core Features

### 2.1 User Roles
| Role | Registration Method | Core Permissions |
|------|---------------------|------------------|
| super_admin | Created/managed by system owner (seed + user management) | Can edit Profile Settings; can view/edit System Settings |
| admin | Created by super_admin | Can edit Profile Settings; can view System Settings (edit only if allowed by policy) |
| operator | Created by super_admin | Can view Profile Settings (edit limited fields); can view System Settings |

### 2.2 Feature Module
Our Admin Settings requirements consist of the following main pages:
1. **Admin Dashboard**: entry point after login, provides navigation to Settings via the left sidebar.
2. **Admin Settings**: profile settings form, system settings form.

### 2.3 Page Details
| Page Name | Module Name | Feature description |
|-----------|-------------|------------------|
| Admin Dashboard | Navigation entry | Provide access to Settings via existing left sidebar navigation (Settings item routes to `/admin/settings`). |
| Admin Settings | Page header | Show page title and short helper text consistent with existing layout. |
| Admin Settings | Profile Settings | View and edit your profile details.
- Edit display name
- Edit email (if permitted)
- Change password (optional, with confirmation)
- Display role as read-only
- Validate inputs and show inline errors
- Save changes and show success/error feedback |
| Admin Settings | System Settings | View and manage system-level settings in a dedicated section.
- View/edit organization or console-level settings (fields defined by product policy)
- Provide safe defaults and clear helper text
- Validate inputs and show inline errors
- Save changes and show success/error feedback |
| Admin Settings | Permissions & states | Enforce role-based editability.
- If user lacks permission, render fields read-only and disable Save
- Show loading state while fetching current settings
- Show empty state if no organization/system context is available |

## 3. Core Process
**Admin flow (super_admin/admin/operator):**
1. You log in and enter the admin console.
2. You open **Settings** from the left sidebar.
3. In **Profile Settings**, you review and update permitted fields, then save.
4. In **System Settings**, you review system configuration; if you have permission, you edit and save.
5. You see confirmation for success, or actionable errors if saving fails.

```mermaid
graph TD
  A["Admin Login"] --> B["Admin Dashboard"]
  B --> C["Admin Settings"]
  C --> D["Profile Settings