export class DirectoryTable extends HTMLElement {
  constructor() {
    super();

    const table = document.createElement('table');
    table.classList.add('table', 'table-lg', 'table-pin-rows');

    const thead = table.createTHead();
    const headerRow = document.createElement('tr');
    const headers = ['Name (sort)'];
    headers.forEach((headerText) => {
      const th = document.createElement('th');
      th.classList.add('cursor-pointer')
      th.textContent = headerText;
      th.value = "asc";
      th.onclick = () => {this.sortTable(th);};
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = table.createTBody();
    this._directories = [];
    
    this.appendChild(table);
  }

  set directories(value) {
    this._directories = value;
    this.updateTable(this._directories);
  }

  get directories() {
    return this._directories;
  }

  updateTable(directories) {
    const table = this.querySelector('table');
    const tbody = this.querySelector('tbody');

    while (table.rows.length > 1) {
      table.deleteRow(1);
    }
    var rowCount = 0;

    for (let [key, directory] of Object.entries(directories)) {
      if (directory.archived == true) {
        continue;
      }
      const row = tbody.insertRow();
      row.classList.add('grid','grid-cols-6', 'gap-2', 'place-content-center', 'hover');
      const nameCell = row.insertCell(0);
      nameCell.classList.add('justify-self-start', 'col-span-2', 'font-medium');
      nameCell.textContent = directory.name;
      console.log(directory, nameCell)
      let linkcell = row.insertCell(1);
      linkcell.classList.add('justify-self-end', 'col-span-1');
      linkcell.innerHTML = `
        <button class="btn btn-ghost btn-xs" onclick="window.open('${window.location.origin + directory.link}','_blank')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><g fill="currentColor" fill-rule="evenodd"><path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5"/><path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z"/></g></svg>
        </button>`
      tbody.appendChild(row);
      rowCount = rowCount + 1;
    };
  }

  sortTable(element) {
    switch (element.value) {
      case "asc":
        var sortedContactList = Object.fromEntries(Object.entries(this._contacts.contactList).sort((a, b) => { return a[1].name.localeCompare(b[1].name) }))
        this.updateTable(sortedContactList);
        element.textContent = "Name  ▼";
        element.value = "desc";
        break;
      case "desc":
        var sortedContactList = Object.fromEntries(Object.entries(this._contacts.contactList).sort((a, b) => { return a[1].name.localeCompare(b[1].name) }).reverse())
        this.updateTable(sortedContactList);
        element.textContent = "Name  ▲";
        element.value = "asc";
        break;
    }
  }
}