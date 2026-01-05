# SteelAxis User Manual

Welcome to **SteelAxis**, your comprehensive solution for steel fabrication management. This manual will guide you through the features and workflows to efficiently manage your inventory, projects, and production.

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Dashboard](#dashboard)
4. [Inventory Management](#inventory-management)
5. [Project Management](#project-management)
    - [Creating a Project](#creating-a-project)
    - [Managing Parts](#managing-parts)
    - [Importing Drawings (AI)](#importing-drawings-ai)
    - [Assemblies](#assemblies)
6. [Usage & Tracking](#usage--tracking)
7. [Production (Work Orders)](#production-work-orders)
8. [Quality Control](#quality-control)
9. [Settings](#settings)

---

## Introduction
SteelAxis is designed to streamline the workflow of steel fabrication shops. It handles everything from raw material inventory to final assembly tracking, ensuring traceability and efficiency.

## Getting Started
To access SteelAxis, navigate to the application URL and log in with your credentials.
- **Login**: Enter your email and password.
- **Roles**: Access to certain features may depend on your user role (e.g., Administrator, Shop Floor).

## Dashboard
Upon logging in, you are greeted by the Dashboard. This is your central hub for quick actions and overview.
- **Quick Links**: key areas like Inventory, Projects, and Usage.
- **Notifications**: See urgent tasks or low stock alerts (if configured).

## Inventory Management
Navigate to the **Inventory** section to manage your raw materials.
- **View Stock**: Browse your current stock of profiles (HEA, IPE, etc.) and plates.
- **Add Stock**: Register new incoming material. You will need to specify:
    - **Profile Type & Dimensions**: e.g., HEA 200.
    - **Grade**: e.g., S355.
    - **Quantity & Length**: Number of pieces and their length.
    - **Certificates**: Upload material certificates for simple traceability.
- **Search Stock**: Use the global search to quickly find if a specific profile is available.

## Project Management
The **Projects** section is where you manage your fabrication jobs.

### Creating a Project
1. Click **New Project**.
2. Enter details like **Project Number**, **Client**, and **Description**.
3. Set a **Priority** and **Dates** to help with scheduling.

### Managing Parts
Inside a project, you can define the parts required.
- **Add Part**: Manually add a part by specifying its profile, dimensions, length, and quantity.
- **Plate Parts**: Manage parts cut from plates, including thickness and dimensions.

### Importing Drawings (AI)
SteelAxis features a powerful AI-assisted import tool to speed up data entry.
1. Click **Import Drawings** within a project.
2. **Upload ZIP**: Drag, and drop a ZIP file containing your PDF drawings.
3. **Choose Mode**:
    - **Parts Mode**: Extracts individual part details (dims, grade, qty) from drawing files.
    - **Assembly Mode**: Parses BOM tables from assembly drawings to create assembly structures.
4. **Review**: The system will present a table of extracted data. Review and correct any details.
5. **Create**: Click "Create Parts" or "Create Assemblies" to add them to your project automatically.

### Assemblies
Group parts into **Assemblies** for better organization.
- Define parent-child relationships (e.g., a "Main Frame" containing "Beams" and "Plates").
- Track the status of entire assemblies rather than just individual pieces.

## Usage & Tracking
Track where your material goes.
- **Register Usage**: When you cut material, record it here.
    - Select the **Inventory Item** used.
    - Specify the **Project** and **Part** it was used for.
    - The system automatically creates **Remnants** (offcuts) if the used length is less than the stock length.
- **Usage History**: View a log of all material consumption for audit purposes.

## Production (Work Orders)
Organize tasks for the shop floor using **Work Orders**. The system intelligently suggests workflows based on material availability.

### Creating Work Orders
- **Smart Creation**: Select parts from the project list and click "Create Work Order".
- **Optimization Preview**: For "Cutting" orders, see an instant 1D nesting preview to know how many bars are needed vs. available in stock.
- **Split Logic**: If you select 100 parts but only have material for 50, the system offers to split the order:
    - **Ready**: Creates a Work Order for the 50 parts you can cut now.
    - **Needs Material**: Creates a Material Prep Work Order for the remaining 50.

### Work Order Types
- **Cutting**: Links to inventory. Completing this generates "Cut" pieces.
- **Machining**: Optional step for drilling/milling.
- **Fabrication/Welding**: Assemble parts into components.
    - **Validation**: Welding WOs cannot be completed until a Visual Testing (VT) Quality Check is passed.
- **Outsourced / HDG**: For parts sent to external vendors (Galvanizing, Laser Cutting).
    - **Drawing Bundling**: Automatically compiles all relevant PDF/DXF drawings into a ZIP file for the vendor.

### Status Tracking
- **Blocked**: WOs waiting for previous steps (e.g., Welding waits for Cutting).
- **In Progress**: Work has started.
- **Completed**: Finished work. Updates individual piece statuses automatically.

## Quality Control
Ensure your products meet standards using the dedicated **Quality Tab**.

### NDT & Inspections
- **Create Inspections**: Schedule checks (VT, UT, MT, RT) for specific Assemblies or the whole Project.
- **Reporting**: Inspectors can mark checks as "Passed", "Failed", or "Waived" and add findings.
- **Validation**: Critical workflows (like Welding) are integrated with QC. You cannot complete a component if it hasn't passed its required NDT.

### NCRs (Non-Conformance Reports)
- Log defects and track their resolution directly linked to the failing assembly.

## Deliveries
Manage the shipping logistics of your finished assemblies.
- **Create Schedule**: Groups assemblies into logical shipments (e.g., "Phase 1 - Truck A").
- **Packing Lists**: Automatically generate professional Packing Lists/Manifests.
    - Click **"Print Packing List"** to open a print-friendly view.
    - Includes weights, assembly numbers, and signature lines.
- **Status**: Track deliveries from "Pending" to "Delivered".

## Settings
Configure the system to match your shop's needs.
- **Grades & Profiles**: Manage standard steel grades and profile types.
- **Scrap Prices**: Update current market prices for scrap estimation.
- **User Management**: (Admin only) Add or remove users.

---

## Key Selling Points & EN 1090 Compliance

SteelAxis is not just another inventory app; it is a purpose-built solution for modern steel fabrication.

### Why SteelAxis?
1.  **AI-Powered Drawing Import**: Stop typing BOMs manually. Upload a ZIP of drawings, and our AI extracts quantities, grades, and dimensions instantly.
2.  **Smart 1D Nesting & Optimization**: Before you cut, SteelAxis calculates the most efficient cutting plan. It automatically suggests using **stock lengths** or high-priority **remnants** to minimize waste.
3.  **End-to-End Workflow Validation**: We don't just track status; we enforce quality. For example, a **Welding Work Order** cannot be marked complete until the mandatory **Visual Testing (VT)** inspection is passed.
4.  **Integrated Outsourcing**: Manage external vendors (Galvanizing, Laser Cutting) as easily as your own shop. Automatically bundle drawings into ZIPs for RFQs.
5.  **Professional Logistics**: Generate and print clear, branded **Packing Lists** and Delivery Schedules to ensure the right steel gets to the right site.

### EN 1090 Compliance Pain Points Solved
For workshops aiming for **EN 1090 Execution Class 2 (EXC2) or higher**, traceability is critical. SteelAxis handles the heavy lifting:
-   **Granular Traceability**: Maintain a digital thread from the raw material certificate (Heat #) to the specific cut piece and final assembly.
-   **Factory Production Control (FPC)**: Document every step. Who cut it? When was it welded? Which machine was used?
-   **Mandatory QC Stops**: Enforce "Hold Points" in your production. The system blocks downstream processes (like painting or shipping) until NDT results are logged.
-   **Documentation**: Simplify the generation of data required for your Declaration of Performance (DoP) and CE Marking.

---

*Verified for SteelAxis v0.5 MVP*
