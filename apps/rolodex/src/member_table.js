export class MemberTable extends HTMLElement {
  gridSize = 'grid-cols-8';
  constructor() {
    super();

    this.filters = {
      lookingFor: [],
      canHelpWith: [],
      expertise: []
    };
    this.filterOptions = {
      lookingFor: ['Gigs', 'Warm Intros', 'Job', 'Partnerships', 'Talent'],
      canHelpWith: ['Testing', 'Design', 'Tokenomics', 'Job/Gig Opportunities', 'GTM', 'Fundraise', 'Introductions', 'Ideation', 'Mentorship'],
      expertise: ['Full Stack', 'Backend', 'Frontend', 'Design', 'Consumer Tech', 'Smart Contracts', 'Frames', 'Data Analysis', 'Community', 'Social']
    };
   
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
    headers.forEach((headerText, index) => {
      const th = document.createElement('th');
      th.classList.add('cursor-pointer','col-span-2', 'relative') //add value for 'col-span-X'  based on corresponding row element size
      
      // Create header content
      const headerContent = document.createElement('div');
      headerContent.classList.add('flex', 'items-center', 'justify-between');
      headerContent.innerHTML = `
        <span>${headerText}</span>
        ${index > 0 ? `
          <button class="filter-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
          </button>
        ` : ''}
      `;
      th.appendChild(headerContent);

      th.value = "asc";
      th.onclick = (e) => {
        if (headerText === 'Name (sort)') {
          this.sortTableBasedOnName(th);
        }
        // Prevent filter dropdown from opening when clicking on the header for sorting
        e.stopPropagation();
      };
      
      // Create filter dropdown for columns other than 'Name'
      if (index > 0) {
        const filterDropdown = document.createElement('div');
        filterDropdown.classList.add('filter-dropdown','max-w-full','hidden', 'absolute', 'top-full', 'left-0','border', 'border-gray-300', 'shadow-lg', 'z-20', 'p-2', 'w-48');        // Add filter options based on column
        // filterDropdown.style.maxHeight = '200px';  //had tried making scrollable, last option
        // filterDropdown.style.overflowY = 'auto';
        filterDropdown.style.backgroundColor = '#0f1729';

        this.createFilterOptions(filterDropdown, headerText.replace(/\s/g, ''));
        
        th.appendChild(filterDropdown);
        
        // Add click event for filter button
        const filterButton = th.querySelector('.filter-button');
        filterButton.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleFilterDropdown(filterDropdown);
        });
      }
      
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    stickyHeader.appendChild(thead);

    const tbody = table.createTBody();

    
    // Append the table to the Shadow DOM
    // Append the sticky header and table to the container
    container.appendChild(stickyHeader);
    container.appendChild(table);

    // Append the container to the Shadow DOM
    this.appendChild(container);

    const scrollableArea = document.createElement('div');
    scrollableArea.classList.add('max-h-[calc(100vh-200px)]', 'overflow-y-auto');
    scrollableArea.appendChild(tbody);
    table.appendChild(scrollableArea);
    this._members = [];

    // Initialize filters
   
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.filter-dropdown') && !e.target.closest('.filter-button')) {
        this.closeAllDropdowns();
      }
    });
  }

  // New method to create filter options
  createFilterOptions(dropdown, column) {
    // Convert column to lowercase for case-insensitive matching
    const lowercaseColumn = column.toLowerCase();
    
    console.log('filter options', this.filterOptions);
    if (!this.filterOptions) {
      console.error('Filter options are undefined in createFilterOptions');
      return;
    }
    // Find the matching key in filterOptions
    const matchingKey = Object.keys(this.filterOptions).find(key => key.toLowerCase() === lowercaseColumn);
    
    if (!matchingKey) {
      console.error(`No filter options found for column: ${column}`);
      return;
    }
    
    const options = this.filterOptions[matchingKey];
    options.forEach(option => {
      const label = document.createElement('label');
      label.classList.add('block', 'mb-1', 'flex', 'items-center','text-ellipsis','overflow-hidden'); // Added flex and items-center
      label.innerHTML = `
        <input type="checkbox" value="${option.toLowerCase()}" class="mr-2 form-checkbox ">
        <span>${option}</span>
      `;
      label.querySelector('input').addEventListener('change', (e) => {
        this.updateFilter(matchingKey, e.target.value, e.target.checked);
      });
      dropdown.appendChild(label);
    });
  }

  toggleFilterDropdown(dropdown) {
    dropdown.classList.toggle('hidden');
  }

  closeAllDropdowns() {
    this.querySelectorAll('.filter-dropdown').forEach(dropdown => {
      dropdown.classList.add('hidden');
    });
  }

  updateFilter(column, value, checked) {
    if (checked) {
      this.filters[column].push(value);
    } else {
      this.filters[column] = this.filters[column].filter(v => v !== value);
    }
    this.applyFilters();
  }

  applyFilters() {
    console.log('this member and this filter', this._members, this.filter);
    if (!this.filters) {
      console.error('Filters are undefined in applyFilter');
      return;
    }
    const filteredMembers = this._members.filter(member => {
      return Object.entries(this.filters).every(([column, filters]) => {
        if (filters.length === 0) return true;
        const memberValues = Array.isArray(member[column]) ? member[column] : [member[column]];
        return filters.some(filter =>
          memberValues.some(value => value.toLowerCase().includes(filter.toLowerCase()))
        );
      });
    });

    this.updateTable(filteredMembers);
  }

  set members(value) {
    this._members = value;
    this.applyFilters();
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

  sortTableBasedOnName(element) {
    switch (element.value) {
      case "asc":
        var sortedMemberList =  this._members.sort((a, b) => {
          return (a.name).localeCompare(b.name);
        });
        this.updateTable(sortedMemberList);
        element.textContent = "Name  ▼";
        element.value = "desc";
        break;
      case "desc":
        var sortedMemberList =  this._members.sort((a, b) => {
          return (b.name).localeCompare(a.name);
        });
        this.updateTable(sortedMemberList);
        element.textContent = "Name  ▲";
        element.value = "asc";
        break;
    }
  }

  resetFilters() {
    // Reset all filters
    Object.keys(this.filters).forEach(key => {
      this.filters[key] = [];
    });

    // Uncheck all checkboxes
    this.querySelectorAll('.filter-dropdown input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = false;
    });

    // Apply the reset filters
    this.applyFilters();
  }
}
