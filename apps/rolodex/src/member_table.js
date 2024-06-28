export class MemberTable extends HTMLElement {
  gridSize = 'grid-cols-8';
  constructor() {
    super();
   
    const container = document.createElement('div');
    container.classList.add('relative');
   
    // Create a sticky header container
    const stickyHeader = document.createElement('div');
    stickyHeader.classList.add('sticky', 'top-0', 'bg-gray-200', 'z-10','table', 'table-lg', 'table-pin-rows' );
   
    // Create a table element
    const table = document.createElement('table');
    table.classList.add('table', 'table-lg', 'table-pin-rows');

    

    // Create the table header row
    const thead = table.createTHead();
    const headerRow = document.createElement('tr');
    headerRow.classList.add('grid', this.gridSize); 
    const headers = ['Name (sort)', 'Looking For', 'Can Help With', 'Expertise']; // Customize as needed
    headers.forEach((headerText) => {
      const th = document.createElement('th');
      th.classList.add('cursor-pointer','col-span-2') //add value for 'col-span-X'  based on corresponding row element size
      th.textContent = headerText;
      th.value = "asc";
      th.onclick = () => {this.sortTable(th);};
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    stickyHeader.appendChild(thead);

    const tbody = table.createTBody();

    
    // Append the table to the Shadow DOM
   // Append the sticky header and table to the container
+   container.appendChild(stickyHeader);
+   container.appendChild(table);
+
+   // Append the container to the Shadow DOM
+   this.appendChild(container);

    const scrollableArea = document.createElement('div');
+   scrollableArea.classList.add('max-h-[calc(100vh-200px)]', 'overflow-y-auto');
+   scrollableArea.appendChild(tbody);
+   table.appendChild(scrollableArea);
    this._members = [];
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
    
    const tbody = this.querySelector('tbody');
    // Clear existing rows
   tbody.innerHTML=''
    var rowCount = 0;

    // Create table rows for contacts
    for (let [key, value] of Object.entries(memberList)) {
      if (value.archived == true) {
        continue;
      }
      const row = tbody.insertRow();
      row.classList.add('grid',this.gridSize, 'gap-2', 'place-content-center', 'hover');
      const nameCell = row.insertCell(0);
      nameCell.classList.add('flex', 'flex-row', 'justify-between', 'w-full', 'items-center', 'col-span-2', 'font-medium');
      nameCell.innerHTML = `<div class="avatar"><div class="w-8 rounded-full"><img src="${value.pfpUrl}" onerror="this.onerror=null;this.src='https://i.imgur.com/tmGAd6X.jpg';"/></div></div> <span class="text-center">${value.name}</span> <a href="https://warpcast.com/${value.handle}" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M18.24.24H5.76A5.76 5.76 0 0 0 0 6v12a5.76 5.76 0 0 0 5.76 5.76h12.48A5.76 5.76 0 0 0 24 18V6A5.76 5.76 0 0 0 18.24.24m.816 17.166v.504a.49.49 0 0 1 .543.48v.568h-5.143v-.569A.49.49 0 0 1 15 17.91v-.504c0-.22.153-.402.358-.458l-.01-4.364c-.158-1.737-1.64-3.098-3.443-3.098c-1.804 0-3.285 1.361-3.443 3.098l-.01 4.358c.228.042.532.208.54.464v.504a.49.49 0 0 1 .543.48v.568H4.392v-.569a.49.49 0 0 1 .543-.479v-.504c0-.253.201-.454.454-.472V9.039h-.49l-.61-2.031H6.93V5.042h9.95v1.966h2.822l-.61 2.03h-.49v7.896c.252.017.453.22.453.472"/></svg></a>`;

      const lookingForCell = row.insertCell(1); 
      lookingForCell.classList.add('col-span-2', 'font-medium', 'space-x-1')
      if (value.lookingFor !== undefined && value.lookingFor.length > 0) {
        let tags = Array.isArray(value.lookingFor) ? value.lookingFor : [value.lookingFor];  // Check if EMAIL is an array, if not, treat it as a single string in an array
        for (let tag of tags) {
          lookingForCell.innerHTML += `<span class="badge badge-md badge-secondary">${tag}</span>`;
        }
      } else {
        lookingForCell.innerHTML = '';
      }
      const canHelpWithCell = row.insertCell(2); 
      canHelpWithCell.classList.add('col-span-2', 'font-medium', 'space-x-1')
      if (value.canHelpWith !== undefined && value.canHelpWith.length > 0) {
        let tags = Array.isArray(value.canHelpWith) ? value.canHelpWith : [value.canHelpWith];  // Check if EMAIL is an array, if not, treat it as a single string in an array
        for (let tag of tags) {
          canHelpWithCell.innerHTML += `<span class="badge badge-md badge-secondary">${tag}</span>`;
        }
      } else {
        canHelpWithCell.innerHTML = '';
      }
      const expertiseCell = row.insertCell(3); 
      expertiseCell.classList.add('col-span-2', 'font-medium', 'space-x-1')
      if (value.expertise !== undefined && value.expertise.length > 0) {
        let tags = Array.isArray(value.expertise) ? value.expertise : [value.expertise];  // Check if EMAIL is an array, if not, treat it as a single string in an array
        for (let tag of tags) {
          expertiseCell.innerHTML += `<span class="badge badge-md badge-secondary">${tag}</span>`;
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