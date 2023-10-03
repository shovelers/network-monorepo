export class ContactTable extends HTMLElement {
  constructor() {
    super();

    // Create a table element
    const table = document.createElement('table');
    table.classList.add('table', 'table-zebra');

    // Create the table header row
    const thead = table.createTHead();
    const headerRow = document.createElement('tr');
    const headers = ['Name']; // Customize as needed
    headers.forEach((headerText) => {
      const th = document.createElement('th');
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = table.createTBody();
    // Create table rows for contacts (initially empty)
    this._contacts = [];
    
    // Append the table to the Shadow DOM
    this.appendChild(table);
  }

  // Define a property setter for the "contacts" property
  set contacts(value) {
    this._contacts = value;
    this.updateTable();
  }

  // Define a property getter for the "contacts" property
  get contacts() {
    return this._contacts;
  }

  // Method to update the table based on the contacts data
  updateTable() {
    const table = this.querySelector('table');
    const tbody = this.querySelector('tbody');
    
    // Clear existing rows
    while (table.rows.length > 1) {
      table.deleteRow(1);
    }

    // Create table rows for contacts
    for (let [key, value] of Object.entries(this._contacts.contactList)) {
      const row = tbody.insertRow();
      row.classList.add('grid','grid-cols-3', 'place-content-center');
      const nameCell = row.insertCell(0);
      nameCell.classList.add('justify-self-start');
      nameCell.textContent = value.name;
      let tagscell = row.insertCell(1);
      if (value.tags !== undefined && value.tags.length > 0 && value.tags[0] !== '') {
        tagscell.classList.add('place-self-center', 'overflow-auto', 'flex', 'space-x-1');
        for (let tag of value.tags) {
          tagscell.innerHTML += `<span class="badge badge-info">${tag}</span>`;
        }
      } else {
        tagscell.innerHTML = '';
      }
      let editcell = row.insertCell(2);
      editcell.classList.add('justify-self-end');
      editcell.innerHTML = `
        <button class="btn btn-ghost btn-xs" onclick="contact_edit_modal.showModal(); setContactEditForm('${key}', '${value.name}', '${value.tags}');">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="m13.498.795l.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001zm-.644.766a.5.5 0 0 0-.707 0L1.95 11.756l-.764 3.057l3.057-.764L14.44 3.854a.5.5 0 0 0 0-.708l-1.585-1.585z"/></svg>
        </button>`
      tbody.appendChild(row);
    };
  }
}