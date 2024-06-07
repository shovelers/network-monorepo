export class MemberTable extends HTMLElement {
  gridSize = 'grid-cols-8';
  constructor() {
    super();
   
    // Create a table element
    const table = document.createElement('table');
    table.classList.add('table', 'table-lg', 'table-pin-rows');

    // Create the table header row
    const thead = table.createTHead();
    const headerRow = document.createElement('tr');
    headerRow.classList.add('grid', this.gridSize); 
    const headers = ['Name (sort)', 'LookingFor', 'InterestedIn', 'Expertise']; // Customize as needed
    headers.forEach((headerText) => {
      const th = document.createElement('th');
      th.classList.add('cursor-pointer','col-span-2') //add value for 'col-span-X'  based on corresponding row element size
      th.textContent = headerText;
      th.value = "asc";
      th.onclick = () => {this.sortTable(th);};
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
  set members(value) {
    this._members = value;
    this.updateTable(this._members);
  }

  // Define a property getter for the "contacts" property
  get members() {
    return this._members;
  }

  // Method to update the table based on the contacts data
  updateTable(memberList) {
    const table = this.querySelector('table');
    const tbody = this.querySelector('tbody');
    // Clear existing rows
    while (table.rows.length > 1) {
      table.deleteRow(1);
    }
    var rowCount = 0;

    // Create table rows for contacts
    for (let [key, value] of Object.entries(memberList)) {
      if (value.archived == true) {
        continue;
      }
      const row = tbody.insertRow();
      row.classList.add('grid',this.gridSize, 'gap-2', 'place-content-center', 'hover');
      const nameCell = row.insertCell(0);
      nameCell.classList.add('justify-self-start', 'col-span-2', 'font-medium');
      nameCell.textContent = `${value.name} (${value.handle})`;

      const lookingForCell = row.insertCell(1); 
      lookingForCell.classList.add('col-span-2', 'font-medium', 'space-x-1')
      if (value.lookingFor !== undefined && value.lookingFor.length > 0) {
        let tags = Array.isArray(value.lookingFor) ? value.lookingFor : [value.lookingFor];  // Check if EMAIL is an array, if not, treat it as a single string in an array
        for (let tag of tags) {
          lookingForCell.innerHTML += `<span class="badge badge-md badge-neutral">${tag}</span>`;
        }
      } else {
        lookingForCell.innerHTML = '';
      }
      const interestedInCell = row.insertCell(2); 
      interestedInCell.classList.add('col-span-2', 'font-medium', 'space-x-1')
      if (value.interestedIn !== undefined && value.interestedIn.length > 0) {
        let tags = Array.isArray(value.interestedIn) ? value.interestedIn : [value.interestedIn];  // Check if EMAIL is an array, if not, treat it as a single string in an array
        for (let tag of tags) {
          interestedInCell.innerHTML += `<span class="badge badge-md badge-neutral">${tag}</span>`;
        }
      } else {
        interestedInCell.innerHTML = '';
      }
      const expertiseCell = row.insertCell(3); 
      expertiseCell.classList.add('col-span-2', 'font-medium', 'space-x-1')
      if (value.expertise !== undefined && value.expertise.length > 0) {
        let tags = Array.isArray(value.expertise) ? value.expertise : [value.expertise];  // Check if EMAIL is an array, if not, treat it as a single string in an array
        for (let tag of tags) {
          expertiseCell.innerHTML += `<span class="badge badge-md badge-neutral">${tag}</span>`;
        }
      } else {
        expertiseCell.innerHTML = '';
      }
     // let editcell = row.insertCell(3);
     // editcell.classList.add('justify-self-end', 'col-span-1');
     // if (value.XML && value.XML.split(':')[0] == 'via') {
     //   editcell.innerHTML = `<span class="badge badge-secondary">${value.XML}</span>`
     // } else if (value.XML && value.XML.split(':')[0] != 'via') {
     //   editcell.innerHTML = `<span class="badge badge-primary">${value.PRODID.split(':')[1]}</span>`
     // } else {
     //   editcell.innerHTML = `
     //   <button class="btn btn-ghost btn-xs" onclick="contact_edit_modal.showModal(); setContactEditForm('${value.UID}');">
     //     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="m13.498.795l.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001zm-.644.766a.5.5 0 0 0-.707 0L1.95 11.756l-.764 3.057l3.057-.764L14.44 3.854a.5.5 0 0 0 0-.708l-1.585-1.585z"/></svg>
     //   </button>`
     // }
      tbody.appendChild(row);
      rowCount = rowCount + 1;
    };

    document.getElementById('member-count').innerHTML = rowCount;
  }

  sortTable(element) {
    switch (element.value) {
      case "asc":
        var sortedMemberList = Object.fromEntries(Object.entries(this._members).sort((a, b) => { return a[1].name.localeCompare(b[1].name) }))
        this.updateTable(sortedMemberList);
        element.textContent = "Name  ▼";
        element.value = "desc";
        break;
      case "desc":
        var sortedMemberList = Object.fromEntries(Object.entries(this._members).sort((a, b) => { return a[1].name.localeCompare(b[1].name) }).reverse())
        this.updateTable(sortedMemberList);
        element.textContent = "Name  ▲";
        element.value = "asc";
        break;
    }
  }
}