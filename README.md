# DBML Viewer

**DBML Viewer** is a VS Code extension that renders DBML (Database Markup Language) files as interactive, beautifully formatted Table Design Documents alongside live Mermaid ER diagrams.

![DBML Viewer](https://raw.githubusercontent.com/dbml-tools/dbml-viewer/main/images/preview.png)

## Features

- 📋 **Comprehensive Table Design Documents**: Displays Table, Column, Index, Enum, and Relationship definitions in clean, monochromatic design cards.
- 🎨 **Dynamic Meta Attributes**: Custom DBML attributes (such as `owner`, `sla`, `pii`, `note`, `description`) are automatically detected and rendered as custom table columns.
- 🔀 **Mermaid ER Diagram Integration**: Automatically generates valid Mermaid ER diagrams showing table cardinalities and foreign key targets.
- 🌐 **Multi-Language Support**: Seamlessly switch interface language between English and Japanese, or auto-detect VS Code's UI language.
- 🧩 **Enums & Import Support**: Supports recursive file imports (`use * from 'path'`), rendering both local and imported Enum definitions.
- 📝 **Sticky Notes & Table Groups**: Full support for standalone DBML `Note` blocks and `TableGroup` definitions.
- 🌓 **Theme Adaptive**: Responds to VS Code light/dark color themes and custom theme settings.

## Usage

1. Open any `.dbml` file in VS Code.
2. Click the **Preview DBML** icon ($(preview)) in the editor title bar, or press `Ctrl+Shift+P` (`Cmd+Shift+P` on macOS) and run `DBML Viewer: Preview DBML`.
3. The preview panel opens on the side and updates automatically as you edit your DBML document.

## Extension Settings

This extension contributes the following settings:

* `dbmlPreview.theme`: Controls the color theme of the DBML preview document.
  * `system` (default): Follows VS Code / OS theme setting.
  * `dark`: Forces dark mode.
  * `light`: Forces light mode.
* `dbmlPreview.language`: Selects the display language for headers and controls.
  * `auto` (default): Uses VS Code's current locale.
  * `en`: English.
  * `ja`: Japanese (日本語).

## DBML Example

```dbml
Project my_project {
  database_type: 'PostgreSQL'
  Note: 'E-commerce platform database design'
}

Enum order_status {
  pending [note: 'Order created but not paid']
  paid
  shipped
  cancelled
}

TableGroup core {
  users
  orders
}

Table users {
  id integer [pk, increment]
  email varchar [not null, unique]
  status order_status [default: 'pending']
  created_at timestamp
  
  indexes {
    email
  }
}

Table orders {
  id integer [pk, increment]
  user_id integer [not null]
  total_amount decimal
  
  indexes {
    user_id
  }
}

Ref: orders.user_id > users.id
```

## License

[MIT](LICENSE)
